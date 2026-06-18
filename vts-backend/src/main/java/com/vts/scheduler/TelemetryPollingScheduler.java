package com.vts.scheduler;

import com.vts.model.TelemetryPayload;
import com.vts.service.LiveTrackingService;
import com.vts.service.ThingsBoardAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TelemetryPollingScheduler {

    private static final Logger log = LoggerFactory.getLogger(TelemetryPollingScheduler.class);

    private final JdbcTemplate           jdbc;
    private final ThingsBoardAuthService tbAuth;
    private final LiveTrackingService    liveTracking;
    private final RestTemplate           restTemplate = new RestTemplate();

    // Cache: vehicleId → ThingsBoard device entity ID (UUID)
    private final ConcurrentHashMap<String, String> deviceIdCache = new ConcurrentHashMap<>();

    public TelemetryPollingScheduler(JdbcTemplate jdbc,
                                     ThingsBoardAuthService tbAuth,
                                     LiveTrackingService liveTracking) {
        this.jdbc         = jdbc;
        this.tbAuth       = tbAuth;
        this.liveTracking = liveTracking;
    }

    // @Scheduled(fixedDelay = 5000)  // DISABLED - Query ThingsBoard directly instead
    public void pollTelemetry() {
        List<Map<String, Object>> vehicles = fetchActiveVehicles();
        if (vehicles.isEmpty()) return;

        log.info("[POLL] {} active vehicle(s) to track", vehicles.size());

        for (Map<String, Object> row : vehicles) {
            String vehicleId  = (String) row.get("vehicle_id");
            String driverName = (String) row.get("driver_name");
            if (vehicleId == null) continue;

            try {
                // Find ThingsBoard device entity ID by vehicle name
                String tbDeviceEntityId = resolveThingsBoardDeviceId(vehicleId);
                if (tbDeviceEntityId == null) {
                    log.warn("[POLL] No ThingsBoard device found for vehicle={}", vehicleId);
                    continue;
                }

                // Fetch latest telemetry using TB JWT auth
                TelemetryPayload payload = fetchTelemetryByEntityId(tbDeviceEntityId, vehicleId, driverName);
                if (payload != null) {
                    log.info("[POLL] Telemetry OK: vehicle={} lat={} lng={} speed={}",
                        vehicleId, payload.getLat(), payload.getLng(), payload.getSpeed());
                    liveTracking.processTelemetry(payload);
                } else {
                    log.warn("[POLL] No telemetry data for vehicle={}", vehicleId);
                }
            } catch (Exception e) {
                log.error("[POLL] Error for vehicle={}: {}", vehicleId, e.getMessage());
            }
        }
    }

    // ── Step 1: Get active trips directly — no device JOIN needed ────────────
    private List<Map<String, Object>> fetchActiveVehicles() {
        try {
            // Use TRIM + ILIKE to handle any whitespace/case issues in status
            List<Map<String, Object>> result = jdbc.queryForList("""
                SELECT DISTINCT
                    t.vehicle_id,
                    dr.driver_name
                FROM public.trips t
                INNER JOIN public.drivers dr ON dr.id = t.driver_id
                WHERE TRIM(t.status) NOT IN ('Completed', 'Cancelled')
                  AND t.vehicle_id IS NOT NULL
                ORDER BY t.vehicle_id
                """);
            log.info("[POLL] Active vehicles from trips: {} → {}", result.size(),
                result.stream().map(r -> r.get("vehicle_id")).toList());
            return result;
        } catch (Exception e) {
            log.error("[POLL] fetchActiveVehicles failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ── Step 2: Find ThingsBoard device entity ID by device name = vehicleId ─
    @SuppressWarnings("unchecked")
    private String resolveThingsBoardDeviceId(String vehicleId) {
        if (deviceIdCache.containsKey(vehicleId)) return deviceIdCache.get(vehicleId);

        try {
            // Search ThingsBoard devices by name matching vehicle registration number
            String url = tbAuth.activeUrl()
                + "/api/tenant/devices?deviceName=" + vehicleId;
            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() != null) {
                Object idObj = res.getBody().get("id");
                if (idObj instanceof Map) {
                    String entityId = (String) ((Map<?, ?>) idObj).get("id");
                    if (entityId != null) {
                        deviceIdCache.put(vehicleId, entityId);
                        log.info("[POLL] Resolved TB device for vehicle={} → entityId={}", vehicleId, entityId);
                        return entityId;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[POLL] resolveThingsBoardDeviceId failed for {}: {}", vehicleId, e.getMessage());
        }

        // Fallback: search by page and match name
        return searchDeviceByName(vehicleId);
    }

    @SuppressWarnings("unchecked")
    private String searchDeviceByName(String vehicleId) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/tenant/devices?pageSize=100&page=0&textSearch=" + vehicleId;
            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() != null && res.getBody().get("data") instanceof List) {
                List<Map<String, Object>> devices = (List<Map<String, Object>>) res.getBody().get("data");
                log.info("[POLL] TB device search for '{}' returned {} devices", vehicleId, devices.size());

                for (Map<String, Object> device : devices) {
                    String name = (String) device.get("name");
                    if (vehicleId.equalsIgnoreCase(name)) {
                        Object idObj = device.get("id");
                        if (idObj instanceof Map) {
                            String entityId = (String) ((Map<?, ?>) idObj).get("id");
                            deviceIdCache.put(vehicleId, entityId);
                            log.info("[POLL] Found TB device by search: vehicle={} → entityId={}", vehicleId, entityId);
                            return entityId;
                        }
                    }
                }
                // Log all device names found to help debug
                log.info("[POLL] TB devices found: {}",
                    devices.stream().map(d -> d.get("name")).toList());
            }
        } catch (Exception e) {
            log.warn("[POLL] searchDeviceByName failed for {}: {}", vehicleId, e.getMessage());
        }
        return null;
    }

    // ── Step 3: Fetch latest telemetry using TB entity ID + JWT auth ──────────
    @SuppressWarnings("unchecked")
    private TelemetryPayload fetchTelemetryByEntityId(String entityId, String vehicleId, String driverName) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + entityId
                + "/values/timeseries?keys=lat,lng,speed,trip_status,overspeed,"
                + "smoking_status,mobile_usage,drowsiness_status,engineRpm,engine_rpm,rpm,battery_percentage";

            log.info("[POLL] Fetching telemetry: {}", url);
            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() == null || res.getBody().isEmpty()) {
                log.warn("[POLL] Empty telemetry for vehicle={} entityId={}", vehicleId, entityId);
                return null;
            }

            Map<String, Object> data = res.getBody();

            // ── VALIDATE: Check if ThingsBoard telemetry is fresh (within 120 seconds) ─
            if (!isTelemetryFresh(data, vehicleId)) {
                log.warn("[POLL] Skipping stale telemetry for vehicle={}", vehicleId);
                return null;
            }

            log.info("[POLL] Raw telemetry for vehicle={}: {}", vehicleId, res.getBody());

            TelemetryPayload p = new TelemetryPayload();
            p.setVehicleId(vehicleId);
            p.setDriverName(driverName);
            p.setLat(extractDouble(data, "lat"));
            p.setLng(extractDouble(data, "lng"));
            p.setSpeed(extractInt(data, "speed"));
            p.setTripStatus(extractString(data, "trip_status"));
            p.setOverspeed(extractString(data, "overspeed"));
            p.setSmokingStatus(extractString(data, "smoking_status"));
            p.setMobileUsage(extractString(data, "mobile_usage"));
            p.setDrowsinessStatus(extractString(data, "drowsiness_status"));
            p.setEngineRpm(extractFirstInt(data, "engineRpm", "engine_rpm", "rpm"));
            p.setBatteryPercentage(extractDouble(data, "battery_percentage"));

            if (p.getLat() == null || p.getLng() == null) {
                log.warn("[POLL] lat/lng missing for vehicle={} — keys in response: {}", vehicleId, data.keySet());
                return null;
            }
            return p;

        } catch (Exception e) {
            log.error("[POLL] fetchTelemetryByEntityId failed for vehicle={}: {}", vehicleId, e.getMessage());
            return null;
        }
    }

    // ── ThingsBoard timeseries format: { "key": [{"ts":..., "value":"..."}] } ─
    private Double extractDouble(Map<String, Object> data, String key) {
        try {
            Object val = data.get(key);
            if (val instanceof List && !((List<?>) val).isEmpty()) {
                Object v = ((Map<?, ?>) ((List<?>) val).get(0)).get("value");
                if (v != null) return Double.parseDouble(v.toString());
            }
        } catch (Exception ignored) {}
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
            if (val instanceof List && !((List<?>) val).isEmpty()) {
                Object v = ((Map<?, ?>) ((List<?>) val).get(0)).get("value");
                return v != null ? v.toString() : null;
            }
        } catch (Exception ignored) {}
        return null;
    }

    // ── Extract timestamp from ThingsBoard timeseries and validate freshness ─
    private Long extractTimestamp(Map<String, Object> data, String key) {
        try {
            Object val = data.get(key);
            if (val instanceof List && !((List<?>) val).isEmpty()) {
                Object ts = ((Map<?, ?>) ((List<?>) val).get(0)).get("ts");
                if (ts != null) return Long.parseLong(ts.toString());
            }
        } catch (Exception ignored) {}
        return null;
    }

    // ── Check if ThingsBoard telemetry is fresh (within 120 seconds) ─
    private boolean isTelemetryFresh(Map<String, Object> data, String vehicleId) {
        try {
            // Extract timestamp from any key (they all have the same timestamp)
            for (String key : data.keySet()) {
                Long ts = extractTimestamp(data, key);
                if (ts != null) {
                    // ThingsBoard timestamp is in milliseconds
                    long tbTimeMs = ts;
                    long currentTimeMs = System.currentTimeMillis();
                    long ageSeconds = (currentTimeMs - tbTimeMs) / 1000;

                    if (ageSeconds > 120) {
                        log.warn("[POLL] Stale telemetry for vehicle={} - age={} seconds (max 120s)", 
                            vehicleId, ageSeconds);
                        return false;
                    }
                    log.info("[POLL] Fresh telemetry for vehicle={} - age={} seconds", 
                        vehicleId, ageSeconds);
                    return true;
                }
            }
            log.warn("[POLL] No timestamp found in telemetry for vehicle={}", vehicleId);
            return false;
        } catch (Exception e) {
            log.error("[POLL] Error checking telemetry freshness for vehicle={}: {}", 
                vehicleId, e.getMessage());
            return false;
        }
    }
}
