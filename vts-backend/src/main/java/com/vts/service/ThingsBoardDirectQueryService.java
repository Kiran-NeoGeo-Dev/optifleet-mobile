package com.vts.service;

import com.vts.model.TelemetryPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ThingsBoardDirectQueryService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardDirectQueryService.class);

    private enum DeviceState {
        ACTIVE,
        INACTIVE,
        UNKNOWN
    }

    private final JdbcTemplate jdbc;
    private final ThingsBoardAuthService tbAuth;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final long LIVE_THRESHOLD_MS = 120_000L; // 120 seconds

    // Cache: vehicleId → ThingsBoard device entity ID (UUID)
    private final Map<String, String> deviceIdCache = new java.util.concurrent.ConcurrentHashMap<>();
    // Cache: "lat,lng" → address (prevents Nominatim 429 rate-limit)
    private final Map<String, String> geocodeCache = new java.util.concurrent.ConcurrentHashMap<>();
    
    // Cache: telemetry data with TTL
    private final Map<String, CachedTelemetry> telemetryCache = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long TELEMETRY_CACHE_TTL_MS = 10_000L; // 10 seconds cache
    private static final int MAX_GEOCODE_CACHE_SIZE = 1000; // Prevent unlimited growth
    
    private static class CachedTelemetry {
        final Map<String, Object> data;
        final long timestamp;
        
        CachedTelemetry(Map<String, Object> data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }
        
        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > TELEMETRY_CACHE_TTL_MS;
        }
    }
    
    /**
     * Clear telemetry cache - useful for testing or forced refresh
     */
    public void clearTelemetryCache() {
        telemetryCache.clear();
        log.info("[TB_DIRECT] Telemetry cache cleared");
    }
    
    /**
     * Clear expired entries from telemetry cache
     */
    public void cleanupExpiredCache() {
        telemetryCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
        
        // Also limit geocode cache size
        if (geocodeCache.size() > MAX_GEOCODE_CACHE_SIZE) {
            // Remove oldest 20% of entries (simple LRU approximation)
            int toRemove = MAX_GEOCODE_CACHE_SIZE / 5;
            geocodeCache.keySet().stream().limit(toRemove).forEach(geocodeCache::remove);
            log.info("[TB_DIRECT] Geocode cache trimmed to {} entries", geocodeCache.size());
        }
    }

    public ThingsBoardDirectQueryService(JdbcTemplate jdbc, ThingsBoardAuthService tbAuth) {
        this.jdbc = jdbc;
        this.tbAuth = tbAuth;
    }

    /**
     * Fetch live telemetry for all active vehicles from ThingsBoard.
     * SuperAdmin: clientId=null, orgId=null → all vehicles.
     * OrgAdmin:   clientId=null, orgId=X   → vehicles in that org only.
     * User:       clientId=X,   orgId=null → vehicles owned by that client.
     * 
     * PERFORMANCE OPTIMIZATION: Batch processing with parallel streams and caching
     */
    public List<Map<String, Object>> fetchAllLiveTelemetry(Long clientId, Long orgId) {
        try {
            // Get active vehicles from trips table
            List<Map<String, Object>> vehicles = fetchFleetVehicles(clientId, orgId);
            if (vehicles.isEmpty()) {
                log.info("[TB_DIRECT] No fleet vehicles found (clientId={})", clientId);
                return List.of();
            }

            // PERFORMANCE OPTIMIZATION: Use parallel stream for concurrent processing
            List<Map<String, Object>> results = vehicles.parallelStream()
                .map(row -> {
                    String vehicleId = (String) row.get("vehicle_id");
                    String driverName = (String) row.get("driver_name");

                    try {
                        // Check cache first
                        CachedTelemetry cached = telemetryCache.get(vehicleId);
                        if (cached != null && !cached.isExpired()) {
                            log.debug("[TB_DIRECT] Cache HIT for vehicle={}", vehicleId);
                            return cached.data;
                        }

                        // Resolve ThingsBoard device ID
                        String tbDeviceEntityId = resolveThingsBoardDeviceId(vehicleId);
                        if (tbDeviceEntityId == null) {
                            log.warn("[TB_DIRECT] No ThingsBoard device found for vehicle={}", vehicleId);
                            return null;
                        }

                        DeviceState nativeState = fetchNativeDeviceState(tbDeviceEntityId, vehicleId);
                        if (nativeState == DeviceState.INACTIVE) {
                            // Clear cache for inactive vehicles to prevent stale data
                            telemetryCache.remove(vehicleId);
                            log.info("[TB_DIRECT] vehicle={} OFFLINE (ThingsBoard state=INACTIVE) - cache cleared", vehicleId);
                            return null;
                        }

                        // Fetch telemetry from ThingsBoard
                        Map<String, Object> telemetry = fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, driverName);
                        if (telemetry == null) {
                            telemetryCache.remove(vehicleId);
                            return null;
                        }
                        telemetry.put("thingsBoardState", nativeState.name());

                        // Priority 2: ThingsBoard telemetry timestamp (>120s -> OFFLINE)
                        Long ts = (Long) telemetry.get("telemetryTimestamp");
                        if (ts == null) {
                            telemetryCache.remove(vehicleId);
                            log.warn("[TB_DIRECT] vehicle={} has no timestamp — OFFLINE", vehicleId);
                            return null;
                        }
                        long ageMs = System.currentTimeMillis() - ts;
                        if (ageMs > LIVE_THRESHOLD_MS) {
                            telemetryCache.remove(vehicleId);
                            log.info("[TB_DIRECT] vehicle={} OFFLINE (age={}s > 120s) - cache cleared", vehicleId, ageMs / 1000);
                            return null;
                        }
                        
                        // Cache the result
                        telemetryCache.put(vehicleId, new CachedTelemetry(telemetry));
                        
                        log.info("[TB_DIRECT] vehicle={} LIVE (tbState={}, age={}s, lat={}, lng={})", vehicleId, nativeState, ageMs / 1000, telemetry.get("lat"), telemetry.get("lng"));
                        return telemetry;

                    } catch (Exception e) {
                        log.error("[TB_DIRECT] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
                        return null;
                    }
                })
                .filter(telemetry -> telemetry != null)
                .toList();

            log.info("[TB_DIRECT] LIVE vehicles: {}/{}", results.size(), vehicles.size());
            return results;

        } catch (Exception e) {
            log.error("[TB_DIRECT] Error fetching all live telemetry: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch telemetry for ALL vehicles (both active and inactive) from ThingsBoard.
     * Inactive vehicles are shown at their last known location with last telemetry timestamp.
     * This method includes an 'isActive' flag to distinguish live vs stale telemetry.
     * 
     * SuperAdmin: clientId=null, orgId=null → all vehicles.
     * OrgAdmin:   clientId=null, orgId=X   → vehicles in that org only.
     * User:       clientId=X,   orgId=null → vehicles owned by that client.
     * 
     * PERFORMANCE OPTIMIZATION: Batch processing with parallel streams and caching
     */
    public List<Map<String, Object>> fetchAllVehicleTelemetryIncludingInactive(Long clientId, Long orgId) {
        try {
            // Get all vehicles from vehicles + associations (no trip requirement)
            List<Map<String, Object>> vehicles = fetchFleetVehicles(clientId, orgId);
            if (vehicles.isEmpty()) {
                log.info("[TB_DIRECT_ALL] No fleet vehicles found (clientId={})", clientId);
                return List.of();
            }

            // PERFORMANCE OPTIMIZATION: Use parallel stream for concurrent processing
            List<Map<String, Object>> results = vehicles.parallelStream()
                .map(row -> {
                    String vehicleId = (String) row.get("vehicle_id");
                    String driverName = (String) row.get("driver_name");

                    try {
                        // Check cache first
                        CachedTelemetry cached = telemetryCache.get(vehicleId);
                        if (cached != null && !cached.isExpired()) {
                            log.debug("[TB_DIRECT_ALL] Cache HIT for vehicle={}", vehicleId);
                            return cached.data;
                        }

                        // Resolve ThingsBoard device ID
                        String tbDeviceEntityId = resolveThingsBoardDeviceId(vehicleId);
                        if (tbDeviceEntityId == null) {
                            log.warn("[TB_DIRECT_ALL] No ThingsBoard device found for vehicle={}", vehicleId);
                            return null;
                        }

                        DeviceState nativeState = fetchNativeDeviceState(tbDeviceEntityId, vehicleId);
                        
                        // Fetch telemetry from ThingsBoard (regardless of device state)
                        Map<String, Object> telemetry = fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, driverName);
                        if (telemetry == null) {
                            log.warn("[TB_DIRECT_ALL] No telemetry data for vehicle={}", vehicleId);
                            return null;
                        }
                        
                        telemetry.put("thingsBoardState", nativeState.name());

                        // Check telemetry timestamp to determine if vehicle is active
                        Long ts = (Long) telemetry.get("telemetryTimestamp");
                        boolean isActive = false;
                        long ageMs = 0;
                        
                        if (ts != null) {
                            ageMs = System.currentTimeMillis() - ts;
                            // Vehicle is active if: device state is not INACTIVE AND telemetry age <= 120s
                            isActive = (nativeState != DeviceState.INACTIVE) && (ageMs <= LIVE_THRESHOLD_MS);
                        }
                        
                        // Add isActive flag to telemetry
                        telemetry.put("isActive", isActive);
                        telemetry.put("telemetryAgeSeconds", ts != null ? (ageMs / 1000) : null);
                        
                        // CRITICAL FIX: Store the actual device-reported trip_status separately
                        // so controller can decide whether to use it or override to "Offline"
                        String deviceReportedStatus = telemetry.get("trip_status") != null ? 
                            telemetry.get("trip_status").toString() : "Idle";
                        telemetry.put("device_reported_trip_status", deviceReportedStatus);
                        
                        // CRITICAL FIX: Set trip_status based on isActive flag consistently
                        // If inactive: always "Offline" regardless of device-reported status
                        // If active: use device-reported status
                        String finalTripStatus = isActive ? deviceReportedStatus : "Offline";
                        telemetry.put("trip_status", finalTripStatus);
                        
                        // Cache the result with final status already determined
                        telemetryCache.put(vehicleId, new CachedTelemetry(telemetry));
                        
                        // DEFENSIVE LOGGING: Status determination details for diagnostics
                        if (isActive) {
                            log.info("[TB_DIRECT_ALL] ✓ vehicle={} ACTIVE (tbState={}, age={}s, tripStatus={}, deviceReported={})", 
                                vehicleId, nativeState, ageMs / 1000, finalTripStatus, deviceReportedStatus);
                        } else {
                            log.warn("[TB_DIRECT_ALL] ✗ vehicle={} INACTIVE (tbState={}, age={}s, reason={}, overriding tripStatus: {} → Offline) - showing last known location", 
                                vehicleId, nativeState, ts != null ? (ageMs / 1000) : -1,
                                nativeState == DeviceState.INACTIVE ? "TB_INACTIVE" : "STALE_TELEMETRY",
                                deviceReportedStatus);
                        }
                        
                        return telemetry;

                    } catch (Exception e) {
                        log.error("[TB_DIRECT_ALL] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
                        return null;
                    }
                })
                .filter(telemetry -> telemetry != null)
                .toList();

            long activeCount = results.stream().filter(r -> Boolean.TRUE.equals(r.get("isActive"))).count();
            long inactiveCount = results.stream().filter(r -> Boolean.FALSE.equals(r.get("isActive"))).count();
            
            log.info("[TB_DIRECT_ALL] Total vehicles: {}, Active: {}, Inactive: {}", 
                results.size(), activeCount, inactiveCount);
            return results;

        } catch (Exception e) {
            log.error("[TB_DIRECT_ALL] Error fetching all vehicle telemetry: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch live telemetry for a single vehicle from ThingsBoard
     * PERFORMANCE OPTIMIZATION: Cache results to avoid repeated API calls
     */
    public Map<String, Object> fetchSingleVehicleTelemetry(String vehicleId) {
        try {
            // Check cache first
            CachedTelemetry cached = telemetryCache.get(vehicleId);
            if (cached != null && !cached.isExpired()) {
                log.debug("[TB_DIRECT] Cache HIT for single vehicle={}", vehicleId);
                return cached.data;
            }

            String tbDeviceEntityId = resolveThingsBoardDeviceId(vehicleId);
            if (tbDeviceEntityId == null) {
                log.warn("[TB_DIRECT] No ThingsBoard device found for vehicle={}", vehicleId);
                return null;
            }

            DeviceState nativeState = fetchNativeDeviceState(tbDeviceEntityId, vehicleId);
            if (nativeState == DeviceState.INACTIVE) {
                log.info("[TB_DIRECT] vehicle={} OFFLINE (ThingsBoard state=INACTIVE)", vehicleId);
                return null;
            }

            Map<String, Object> telemetry = fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, null);
            if (telemetry == null) return null;
            telemetry.put("thingsBoardState", nativeState.name());

            Long ts = (Long) telemetry.get("telemetryTimestamp");
            if (ts == null) {
                log.warn("[TB_DIRECT] vehicle={} has no timestamp — OFFLINE", vehicleId);
                return null;
            }

            long ageMs = System.currentTimeMillis() - ts;
            if (ageMs > LIVE_THRESHOLD_MS) {
                log.info("[TB_DIRECT] vehicle={} OFFLINE (age={}s > 120s)", vehicleId, ageMs / 1000);
                return null;
            }

            // Cache the result
            telemetryCache.put(vehicleId, new CachedTelemetry(telemetry));

            return telemetry;

        } catch (Exception e) {
            log.error("[TB_DIRECT] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
            return null;
        }
    }

    public boolean isVehicleLive(String vehicleId) {
        return fetchSingleVehicleTelemetry(vehicleId) != null;
    }

    /**
     * Fetch fleet vehicles from vehicles + associations only — NO trip required.
     * SuperAdmin (clientId=null, orgId=null) → all vehicles.
     * OrgAdmin   (clientId=null, orgId=X)   → vehicles in that org.
     * User       (clientId=X,   orgId=null) → vehicles owned by that client.
     */
    private List<Map<String, Object>> fetchFleetVehicles(Long clientId, Long orgId) {
        try {
            final String base = """
                SELECT DISTINCT
                    v.registration_no AS vehicle_id,
                    COALESCE(d.driver_name, '') AS driver_name
                FROM public.vehicles v
                INNER JOIN public.associations a ON a.vehicle_id = v.id AND a.status = true
                LEFT  JOIN public.drivers d      ON d.id = a.driver_id
                """;

            List<Map<String, Object>> rows;
            if (clientId != null) {
                rows = jdbc.queryForList(base + "WHERE v.client_id = ? ORDER BY v.registration_no", clientId);
            } else if (orgId != null) {
                rows = jdbc.queryForList(base + "WHERE v.org_id = ? ORDER BY v.registration_no", orgId);
            } else {
                rows = jdbc.queryForList(base + "ORDER BY v.registration_no");
            }
            log.info("[TB_DIRECT] fetchFleetVehicles found {} vehicles (clientId={}, orgId={})", rows.size(), clientId, orgId);
            return rows;
        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchFleetVehicles failed: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveThingsBoardDeviceId(String vehicleId) {
        // Check cache first (significantly improves performance)
        if (deviceIdCache.containsKey(vehicleId)) {
            return deviceIdCache.get(vehicleId);
        }

        try {
            String encodedVehicleId = URLEncoder.encode(vehicleId, StandardCharsets.UTF_8);
            String url = tbAuth.activeUrl() + "/api/tenant/devices?deviceName=" + encodedVehicleId;
            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() != null) {
                Object idObj = res.getBody().get("id");
                if (idObj instanceof Map) {
                    String entityId = (String) ((Map<?, ?>) idObj).get("id");
                    if (entityId != null) {
                        deviceIdCache.put(vehicleId, entityId);
                        log.debug("[TB_DIRECT] Cached device ID for vehicle={}", vehicleId);
                        return entityId;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[TB_DIRECT] resolveThingsBoardDeviceId failed for {}: {}", vehicleId, e.getMessage());
        }

        return searchDeviceByName(vehicleId);
    }

    @SuppressWarnings("unchecked")
    private String searchDeviceByName(String vehicleId) {
        try {
            String encodedVehicleId = URLEncoder.encode(vehicleId, StandardCharsets.UTF_8);
            String url = tbAuth.activeUrl()
                + "/api/tenant/devices?pageSize=100&page=0&textSearch=" + encodedVehicleId;
            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() != null && res.getBody().get("data") instanceof List) {
                List<Map<String, Object>> devices = (List<Map<String, Object>>) res.getBody().get("data");

                for (Map<String, Object> device : devices) {
                    String name = (String) device.get("name");
                    if (vehicleId.equalsIgnoreCase(name)) {
                        Object idObj = device.get("id");
                        if (idObj instanceof Map) {
                            String entityId = (String) ((Map<?, ?>) idObj).get("id");
                            deviceIdCache.put(vehicleId, entityId);
                            return entityId;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[TB_DIRECT] searchDeviceByName failed for {}: {}", vehicleId, e.getMessage());
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private DeviceState fetchNativeDeviceState(String entityId, String vehicleId) {
        List<String> urls = List.of(
            tbAuth.activeUrl() + "/api/device/" + entityId,
            tbAuth.activeUrl() + "/api/devices/" + entityId
        );

        for (String url : urls) {
            try {
                ResponseEntity<Map> res = restTemplate.exchange(
                    url, HttpMethod.GET, tbAuth.authEntity(), Map.class);
                DeviceState parsed = parseNativeDeviceState(res.getBody());
                if (parsed != DeviceState.UNKNOWN) {
                    return parsed;
                }
            } catch (Exception e) {
                log.debug("[TB_DIRECT] device state fetch failed for vehicle={} url={}: {}",
                    vehicleId, url, e.getMessage());
            }
        }

        DeviceState attrState = fetchNativeDeviceStateFromServerAttributes(entityId, vehicleId);
        if (attrState != DeviceState.UNKNOWN) return attrState;

        log.warn("[TB_DIRECT] Native ThingsBoard state unavailable for vehicle={} entityId={} - falling back to telemetry age only",
            vehicleId, entityId);
        return DeviceState.UNKNOWN;
    }

    @SuppressWarnings("unchecked")
    private DeviceState fetchNativeDeviceStateFromServerAttributes(String entityId, String vehicleId) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + entityId
                + "/values/attributes/SERVER_SCOPE?keys=active,state,lastActivityTime";
            ResponseEntity<List> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), List.class);
            List<?> attrs = res.getBody();
            if (attrs == null) return DeviceState.UNKNOWN;
            for (Object attr : attrs) {
                if (!(attr instanceof Map)) continue;
                Map<?, ?> m = (Map<?, ?>) attr;
                Object key = m.get("key");
                if (key == null) continue;
                if ("active".equalsIgnoreCase(key.toString()) || "state".equalsIgnoreCase(key.toString())) {
                    DeviceState parsed = parseStateValue(m.get("value"));
                    if (parsed != DeviceState.UNKNOWN) return parsed;
                }
            }
        } catch (Exception e) {
            log.debug("[TB_DIRECT] server-scope device state fetch failed for vehicle={}: {}",
                vehicleId, e.getMessage());
        }
        return DeviceState.UNKNOWN;
    }

    private DeviceState parseNativeDeviceState(Map<?, ?> body) {
        if (body == null) return DeviceState.UNKNOWN;

        DeviceState fromState = parseStateValue(findValueIgnoreCase(body, "state", 0));
        if (fromState != DeviceState.UNKNOWN) return fromState;

        DeviceState fromActive = parseStateValue(findValueIgnoreCase(body, "active", 0));
        if (fromActive != DeviceState.UNKNOWN) return fromActive;

        return DeviceState.UNKNOWN;
    }

    private Object findValueIgnoreCase(Object node, String key, int depth) {
        if (node == null || depth > 6) return null;
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() != null && key.equalsIgnoreCase(entry.getKey().toString())) {
                    return entry.getValue();
                }
            }
            for (Object value : map.values()) {
                Object match = findValueIgnoreCase(value, key, depth + 1);
                if (match != null) return match;
            }
        } else if (node instanceof List<?> list) {
            for (Object value : list) {
                Object match = findValueIgnoreCase(value, key, depth + 1);
                if (match != null) return match;
            }
        }
        return null;
    }

    private DeviceState parseStateValue(Object value) {
        if (value == null) return DeviceState.UNKNOWN;
        if (value instanceof Boolean b) return b ? DeviceState.ACTIVE : DeviceState.INACTIVE;
        if (value instanceof Number n) return n.intValue() != 0 ? DeviceState.ACTIVE : DeviceState.INACTIVE;

        String s = value.toString().trim();
        if (s.isEmpty()) return DeviceState.UNKNOWN;
        if ("ACTIVE".equalsIgnoreCase(s) ||
            "ONLINE".equalsIgnoreCase(s) ||
            "CONNECTED".equalsIgnoreCase(s) ||
            "STARTED".equalsIgnoreCase(s) ||
            "TRUE".equalsIgnoreCase(s) ||
            "1".equals(s)) {
            return DeviceState.ACTIVE;
        }
        if ("INACTIVE".equalsIgnoreCase(s) ||
            "OFFLINE".equalsIgnoreCase(s) ||
            "DISCONNECTED".equalsIgnoreCase(s) ||
            "STOPPED".equalsIgnoreCase(s) ||
            "FALSE".equalsIgnoreCase(s) ||
            "0".equals(s)) {
            return DeviceState.INACTIVE;
        }
        return DeviceState.UNKNOWN;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchTelemetryFromThingsBoard(String entityId, String vehicleId, String driverName) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + entityId
                + "/values/timeseries?keys=lat,lng,speed,trip_status,overspeed,"
                + "smoking_status,mobile_usage,drowsiness_status,harsh_braking,harsh_acceleration,rash_turning,engineRpm,engine_rpm,rpm,battery_percentage,battery_status,ignition_status,"
                + "device_status,hdop,gps_accuracy,event_time,signal_strength";  // Added signal_strength

            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() == null || res.getBody().isEmpty()) {
                log.warn("[TB_DIRECT] Empty response from ThingsBoard for vehicle={}", vehicleId);
                return null;
            }

            Map<String, Object> data = res.getBody();
            
            // Debug logging (only enabled in development)
            if (log.isDebugEnabled()) {
                log.debug("[TB_DIRECT] THINGSBOARD RESPONSE FOR VEHICLE {}", vehicleId);
                log.debug("Full response keys: {}", data.keySet());
                
                if (data.containsKey("battery_percentage")) {
                    log.debug("battery_percentage present! Value: {}", data.get("battery_percentage"));
                }
                if (data.containsKey("battery_status")) {
                    log.debug("battery_status present! Value: {}", data.get("battery_status"));
                }
            }
            // ========== END DEBUG ==========

            // Extract coordinates
            Double lat = extractDouble(data, "lat");
            Double lng = extractDouble(data, "lng");

            // CRITICAL FIX: Extract event_time which is a STRING in format "DD-MM-YYYYHH:mm:ss"
            // Example: "25-09-202617:41:36" means September 25, 2026 at 17:41:36
            String eventTimeString = extractString(data, "event_time");
            
            Long ts = null;
            String lastUpdateTime = "";
            String lastUpdateDate = "";
            
            if (eventTimeString != null && !eventTimeString.isEmpty()) {
                try {
                    // Parse the custom format: "DD-MM-YYYYHH:mm:ss"
                    // Need to insert a space before time: "25-09-2026 17:41:36"
                    String normalized = eventTimeString;
                    if (eventTimeString.length() >= 16) {
                        // Insert space between date and time: "DD-MM-YYYY HH:mm:ss"
                        normalized = eventTimeString.substring(0, 10) + " " + eventTimeString.substring(10);
                    }
                    
                    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
                    java.time.LocalDateTime localDateTime = java.time.LocalDateTime.parse(normalized, formatter);
                    ZoneId zone = ZoneId.of("Asia/Kolkata");
                    java.time.ZonedDateTime zonedDateTime = localDateTime.atZone(zone);
                    ts = zonedDateTime.toInstant().toEpochMilli();
                    
                    // Format for display
                    lastUpdateTime = DateTimeFormatter.ofPattern("hh:mm a").format(zonedDateTime);
                    lastUpdateDate = DateTimeFormatter.ofPattern("dd/MM/yyyy").format(zonedDateTime);
                    
                    log.info("[TB_DIRECT] ✓ vehicle={} event_time string: '{}' → parsed to: {} {} (timestamp: {})", 
                        vehicleId, eventTimeString, lastUpdateTime, lastUpdateDate, ts);
                } catch (Exception e) {
                    log.error("[TB_DIRECT] ✗ vehicle={} Failed to parse event_time '{}': {}", 
                        vehicleId, eventTimeString, e.getMessage());
                    // Fallback to extracting from ts field
                    ts = extractAnyTimestamp(data);
                    if (ts != null) {
                        Instant instant = Instant.ofEpochMilli(ts);
                        ZoneId zone = ZoneId.of("Asia/Kolkata");
                        lastUpdateTime = DateTimeFormatter.ofPattern("hh:mm a").withZone(zone).format(instant);
                        lastUpdateDate = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone).format(instant);
                    }
                }
            } else {
                log.warn("[TB_DIRECT] vehicle={} has no event_time, trying fallback extraction", vehicleId);
                // Fallback to old timestamp extraction method
                ts = extractAnyTimestamp(data);
                if (ts != null) {
                    Instant instant = Instant.ofEpochMilli(ts);
                    ZoneId zone = ZoneId.of("Asia/Kolkata");
                    lastUpdateTime = DateTimeFormatter.ofPattern("hh:mm a").withZone(zone).format(instant);
                    lastUpdateDate = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone).format(instant);
                }
            }
            
            if (ts == null) {
                log.error("[TB_DIRECT] ✗ vehicle={} NO TIMESTAMP EXTRACTED AT ALL!", vehicleId);
            }

            // Reverse geocode
            String address = (lat != null && lng != null) ? reverseGeocode(lat, lng) : "";
            String coordinates = (lat != null && lng != null)
                ? String.format("%.6f, %.6f", lat, lng) : "";

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("vehicle_id", vehicleId);
            result.put("driver_name", driverName);
            result.put("lat", lat);
            result.put("lng", lng);
            result.put("speed", extractInt(data, "speed"));
            result.put("trip_status", extractString(data, "trip_status"));
            result.put("overspeed", extractString(data, "overspeed"));
            result.put("smoking_status", extractString(data, "smoking_status"));
            result.put("mobile_usage", extractString(data, "mobile_usage"));
            result.put("drowsiness_status", extractString(data, "drowsiness_status"));
            result.put("harsh_braking",      extractString(data, "harsh_braking"));
            result.put("harsh_acceleration", extractString(data, "harsh_acceleration"));
            result.put("rash_turning",       extractString(data, "rash_turning"));
            result.put("engineRpm", extractFirstInt(data, "engineRpm", "engine_rpm", "rpm"));
            
            // Extract battery values with detailed logging
            Double batteryPercentage = extractDouble(data, "battery_percentage");
            String batteryStatus = extractString(data, "battery_status");
            log.info("[TB_DIRECT] Extracted battery values for vehicle={}: percentage={}, status={}", 
                vehicleId, batteryPercentage, batteryStatus);
            
            result.put("battery_percentage", batteryPercentage);
            result.put("battery_status", batteryStatus);
            result.put("ignition_status", extractString(data, "ignition_status"));
            result.put("device_status", extractString(data, "device_status"));
            result.put("hdop", extractDouble(data, "hdop"));
            result.put("gps_accuracy", extractDouble(data, "gps_accuracy"));
            result.put("signal_strength", extractInt(data, "signal_strength"));  // Added signal_strength
            result.put("last_telemetry_timestamp", ts);
            result.put("address", address);
            result.put("coordinates", coordinates);
            result.put("lastUpdateTime", lastUpdateTime);
            result.put("lastUpdateDate", lastUpdateDate);
            // Internal: used by fetchAllLiveTelemetry for LIVE check — NOT sent to frontend
            result.put("telemetryTimestamp", ts);

            log.info("[TB_DIRECT] ✓ Returning telemetry for vehicle={} with lastUpdateTime='{}' lastUpdateDate='{}'", 
                vehicleId, lastUpdateTime, lastUpdateDate);

            return result;

        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchTelemetryFromThingsBoard failed for vehicle={}: {}", vehicleId, e.getMessage());
            return null;
        }
    }

    /**
     * Extract the most recent timestamp from any telemetry key.
     * Returns null if no timestamps found.
     */
    private Long extractAnyTimestamp(Map<String, Object> data) {
        Long latest = null;
        log.debug("[TB_EXTRACT_TS] Starting timestamp extraction from {} keys", data.size());
        
        for (String key : data.keySet()) {
            try {
                Object val = data.get(key);
                if (val instanceof List && !((List<?>) val).isEmpty()) {
                    Object firstItem = ((List<?>) val).get(0);
                    if (firstItem instanceof Map) {
                        Object ts = ((Map<?, ?>) firstItem).get("ts");
                        if (ts != null) {
                            long t = Long.parseLong(ts.toString());
                            log.debug("[TB_EXTRACT_TS] Found timestamp in key '{}': {}", key, t);
                            if (latest == null || t > latest) {
                                latest = t;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.debug("[TB_EXTRACT_TS] Error extracting timestamp from key '{}': {}", key, e.getMessage());
            }
        }
        
        if (latest == null) {
            log.warn("[TB_EXTRACT_TS] No timestamp found in telemetry data! Keys present: {}", data.keySet());
        } else {
            log.info("[TB_EXTRACT_TS] Extracted latest timestamp: {} ({})", 
                latest, Instant.ofEpochMilli(latest).atZone(ZoneId.of("Asia/Kolkata")));
        }
        
        return latest;
    }

    /**
     * Reverse geocode lat/lng to a human-readable address via Nominatim.
     * Falls back to "lat, lng" string on any failure.
     */
    @SuppressWarnings("unchecked")
    String reverseGeocode(double lat, double lng) {
        String cacheKey = String.format("%.3f,%.3f", lat, lng);
        String cached = geocodeCache.get(cacheKey);
        if (cached != null) return cached;
        try {
            String url = String.format(
                "https://nominatim.openstreetmap.org/reverse?lat=%f&lon=%f&format=json", lat, lng);
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("User-Agent", "OptiFleet-VTS/1.0");
            org.springframework.http.HttpEntity<?> entity =
                new org.springframework.http.HttpEntity<>(headers);
            ResponseEntity<Map> res = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (res.getBody() != null) {
                Object displayName = res.getBody().get("display_name");
                if (displayName != null) {
                    String address = displayName.toString();
                    geocodeCache.put(cacheKey, address);
                    return address;
                }
            }
        } catch (Exception e) {
            log.debug("[TB_DIRECT] reverseGeocode failed for {},{}: {}", lat, lng, e.getMessage());
        }
        return String.format("%.6f, %.6f", lat, lng);
    }

    private Double extractDouble(Map<String, Object> data, String key) {
        try {
            Object val = data.get(key);
            if (val == null) {
                log.debug("[TB_EXTRACT] Key '{}' not found in telemetry data", key);
                return null;
            }
            
            // Handle array format: [{ "ts": ..., "value": ... }]
            if (val instanceof List) {
                List<?> list = (List<?>) val;
                if (!list.isEmpty()) {
                    Object firstItem = list.get(0);
                    if (firstItem instanceof Map) {
                        Object v = ((Map<?, ?>) firstItem).get("value");
                        if (v != null) {
                            try {
                                return Double.parseDouble(v.toString());
                            } catch (NumberFormatException e) {
                                log.warn("[TB_EXTRACT] Failed to parse '{}' as Double: value='{}', error: {}", 
                                    key, v, e.getMessage());
                                return null;
                            }
                        }
                    }
                }
            }
            // Handle direct numeric value
            else if (val instanceof Number) {
                return ((Number) val).doubleValue();
            }
            // Try to parse string
            else {
                try {
                    return Double.parseDouble(val.toString());
                } catch (NumberFormatException e) {
                    log.debug("[TB_EXTRACT] Failed to parse '{}' as Double: value='{}', type={}", 
                        key, val, val.getClass().getName());
                    return null;
                }
            }
        } catch (Exception e) {
            log.warn("[TB_EXTRACT] Exception extracting Double for key '{}': {}", key, e.getMessage());
        }
        return null;
    }

    private Integer extractInt(Map<String, Object> data, String key) {
        Double d = extractDouble(data, key);
        return d != null ? d.intValue() : null;
    }

    private Long extractLong(Map<String, Object> data, String key) {
        try {
            Object val = data.get(key);
            if (val == null) {
                log.debug("[TB_EXTRACT] Key '{}' not found in telemetry data", key);
                return null;
            }
            
            // Handle array format: [{ "ts": ..., "value": ... }]
            if (val instanceof List) {
                List<?> list = (List<?>) val;
                if (!list.isEmpty()) {
                    Object firstItem = list.get(0);
                    if (firstItem instanceof Map) {
                        Object v = ((Map<?, ?>) firstItem).get("value");
                        if (v != null) {
                            try {
                                return Long.parseLong(v.toString());
                            } catch (NumberFormatException e) {
                                log.warn("[TB_EXTRACT] Failed to parse '{}' as Long: value='{}', error: {}", 
                                    key, v, e.getMessage());
                                return null;
                            }
                        }
                    }
                }
            }
            // Handle direct numeric value
            else if (val instanceof Number) {
                return ((Number) val).longValue();
            }
            // Try to parse string
            else {
                try {
                    return Long.parseLong(val.toString());
                } catch (NumberFormatException e) {
                    log.debug("[TB_EXTRACT] Failed to parse '{}' as Long: value='{}', type={}", 
                        key, val, val.getClass().getName());
                    return null;
                }
            }
        } catch (Exception e) {
            log.warn("[TB_EXTRACT] Exception extracting Long for key '{}': {}", key, e.getMessage());
        }
        return null;
    }

    private Integer extractFirstInt(Map<String, Object> data, String... keys) {
        for (String key : keys) {
            Integer value = extractInt(data, key);
            if (value != null) return value;
        }
        return null;
    }

    private String extractString(Map<String, Object> data, String key) {
        try {
            Object val = data.get(key);
            if (val == null) {
                log.debug("[TB_EXTRACT] Key '{}' not found in telemetry data", key);
                return null;
            }
            
            // Handle array format: [{ "ts": ..., "value": ... }]
            if (val instanceof List) {
                List<?> list = (List<?>) val;
                if (!list.isEmpty()) {
                    Object firstItem = list.get(0);
                    if (firstItem instanceof Map) {
                        Object v = ((Map<?, ?>) firstItem).get("value");
                        return v != null ? v.toString() : null;
                    }
                }
            }
            // Handle direct string value
            else {
                return val.toString();
            }
        } catch (Exception e) {
            log.warn("[TB_EXTRACT] Exception extracting String for key '{}': {}", key, e.getMessage());
        }
        return null;
    }

    /**
     * Fetch battery telemetry for a specific device using ThingsBoard entity ID.
     * Returns battery_percentage and battery_status.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchDeviceBatteryTelemetry(String thingsboardDeviceId) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + thingsboardDeviceId
                + "/values/timeseries?keys=battery_percentage,battery_status";

            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() == null || res.getBody().isEmpty()) {
                log.warn("[TB_DIRECT] Empty battery response from ThingsBoard for device={}", thingsboardDeviceId);
                return null;
            }

            Map<String, Object> data = res.getBody();
            
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("battery_percentage", extractDouble(data, "battery_percentage"));
            result.put("battery_status", extractString(data, "battery_status"));

            log.info("[TB_DIRECT] ✓ Returning battery telemetry for device={}: {}%, status={}", 
                thingsboardDeviceId, result.get("battery_percentage"), result.get("battery_status"));

            return result;

        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchDeviceBatteryTelemetry failed for device={}: {}", thingsboardDeviceId, e.getMessage());
            return null;
        }
    }
}
