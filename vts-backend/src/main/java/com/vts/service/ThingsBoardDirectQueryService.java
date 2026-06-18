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
    private final Map<String, String> deviceIdCache = new HashMap<>();
    // Cache: "lat,lng" → address (prevents Nominatim 429 rate-limit)
    private final Map<String, String> geocodeCache = new java.util.concurrent.ConcurrentHashMap<>();

    public ThingsBoardDirectQueryService(JdbcTemplate jdbc, ThingsBoardAuthService tbAuth) {
        this.jdbc = jdbc;
        this.tbAuth = tbAuth;
    }

    /**
     * Fetch live telemetry for all active vehicles from ThingsBoard
     */
    public List<Map<String, Object>> fetchAllLiveTelemetry(Long clientId) {
        try {
            // Get active vehicles from trips table
            List<Map<String, Object>> vehicles = fetchFleetVehicles(clientId);
            if (vehicles.isEmpty()) {
                log.info("[TB_DIRECT] No fleet vehicles found (clientId={})", clientId);
                return List.of();
            }

            List<Map<String, Object>> results = new ArrayList<>();

            for (Map<String, Object> row : vehicles) {
                String vehicleId = (String) row.get("vehicle_id");
                String driverName = (String) row.get("driver_name");

                try {
                    // Resolve ThingsBoard device ID
                    String tbDeviceEntityId = resolveThingsBoardDeviceId(vehicleId);
                    if (tbDeviceEntityId == null) {
                        log.warn("[TB_DIRECT] No ThingsBoard device found for vehicle={}", vehicleId);
                        continue;
                    }

                    DeviceState nativeState = fetchNativeDeviceState(tbDeviceEntityId, vehicleId);
                    if (nativeState == DeviceState.INACTIVE) {
                        log.info("[TB_DIRECT] vehicle={} OFFLINE (ThingsBoard state=INACTIVE)", vehicleId);
                        continue;
                    }

                    // Fetch telemetry from ThingsBoard
                    Map<String, Object> telemetry = fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, driverName);
                    if (telemetry == null) continue;
                    telemetry.put("thingsBoardState", nativeState.name());

                    // Priority 2: ThingsBoard telemetry timestamp (>120s -> OFFLINE)
                    Long ts = (Long) telemetry.get("telemetryTimestamp");
                    if (ts == null) {
                        log.warn("[TB_DIRECT] vehicle={} has no timestamp — OFFLINE", vehicleId);
                        continue;
                    }
                    long ageMs = System.currentTimeMillis() - ts;
                    if (ageMs > LIVE_THRESHOLD_MS) {
                        log.info("[TB_DIRECT] vehicle={} OFFLINE (age={}s > 120s)", vehicleId, ageMs / 1000);
                        continue;
                    }
                    log.info("[TB_DIRECT] vehicle={} LIVE (tbState={}, age={}s, lat={}, lng={})", vehicleId, nativeState, ageMs / 1000, telemetry.get("lat"), telemetry.get("lng"));
                    results.add(telemetry);

                } catch (Exception e) {
                    log.error("[TB_DIRECT] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
                }
            }

            log.info("[TB_DIRECT] LIVE vehicles: {}/{}", results.size(), vehicles.size());
            return results;

        } catch (Exception e) {
            log.error("[TB_DIRECT] Error fetching all live telemetry: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch live telemetry for a single vehicle from ThingsBoard
     */
    public Map<String, Object> fetchSingleVehicleTelemetry(String vehicleId) {
        try {
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
     * Admin (clientId=null) → all vehicles. User → only their vehicles.
     */
    private List<Map<String, Object>> fetchFleetVehicles(Long clientId) {
        try {
            String sql = clientId != null
                ? """
                  SELECT DISTINCT
                      v.registration_no AS vehicle_id,
                      COALESCE(d.driver_name, '') AS driver_name
                  FROM public.vehicles v
                  INNER JOIN public.associations a ON a.vehicle_id = v.id AND a.status = true
                  LEFT  JOIN public.drivers d      ON d.id = a.driver_id
                  WHERE v.client_id = ?
                  ORDER BY v.registration_no
                  """
                : """
                  SELECT DISTINCT
                      v.registration_no AS vehicle_id,
                      COALESCE(d.driver_name, '') AS driver_name
                  FROM public.vehicles v
                  INNER JOIN public.associations a ON a.vehicle_id = v.id AND a.status = true
                  LEFT  JOIN public.drivers d      ON d.id = a.driver_id
                  ORDER BY v.registration_no
                  """;

            List<Map<String, Object>> rows = clientId != null
                ? jdbc.queryForList(sql, clientId)
                : jdbc.queryForList(sql);
            log.info("[TB_DIRECT] fetchFleetVehicles found {} vehicles (clientId={})", rows.size(), clientId);
            return rows;
        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchFleetVehicles failed: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveThingsBoardDeviceId(String vehicleId) {
        if (deviceIdCache.containsKey(vehicleId)) return deviceIdCache.get(vehicleId);

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
                + "smoking_status,mobile_usage,drowsiness_status,engineRpm,engine_rpm,rpm,battery_percentage,ignition_status,"
                + "device_status,hdop,gps_accuracy,last_telemetry_timestamp";

            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() == null || res.getBody().isEmpty()) {
                return null;
            }

            Map<String, Object> data = res.getBody();

            // Extract coordinates
            Double lat = extractDouble(data, "lat");
            Double lng = extractDouble(data, "lng");

            // Extract last telemetry timestamp
            Long ts = extractAnyTimestamp(data);
            String lastUpdateTime = "";
            String lastUpdateDate = "";
            if (ts != null) {
                Instant instant = Instant.ofEpochMilli(ts);
                ZoneId zone = ZoneId.of("Asia/Kolkata");
                lastUpdateTime = DateTimeFormatter.ofPattern("hh:mm a").withZone(zone).format(instant);
                lastUpdateDate = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone).format(instant);
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
            result.put("engineRpm", extractFirstInt(data, "engineRpm", "engine_rpm", "rpm"));
            result.put("battery_percentage", extractDouble(data, "battery_percentage"));
            result.put("ignition_status", extractString(data, "ignition_status"));
            result.put("device_status", extractString(data, "device_status"));
            result.put("hdop", extractDouble(data, "hdop"));
            result.put("gps_accuracy", extractDouble(data, "gps_accuracy"));
            result.put("last_telemetry_timestamp", ts);
            result.put("address", address);
            result.put("coordinates", coordinates);
            result.put("lastUpdateTime", lastUpdateTime);
            result.put("lastUpdateDate", lastUpdateDate);
            // Internal: used by fetchAllLiveTelemetry for LIVE check — NOT sent to frontend
            result.put("telemetryTimestamp", ts);

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
        for (String key : data.keySet()) {
            try {
                Object val = data.get(key);
                if (val instanceof List && !((List<?>) val).isEmpty()) {
                    Object ts = ((Map<?, ?>) ((List<?>) val).get(0)).get("ts");
                    if (ts != null) {
                        long t = Long.parseLong(ts.toString());
                        if (latest == null || t > latest) latest = t;
                    }
                }
            } catch (Exception ignored) {}
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
}
