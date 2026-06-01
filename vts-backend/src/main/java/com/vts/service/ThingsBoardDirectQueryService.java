package com.vts.service;

import com.vts.model.TelemetryPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class ThingsBoardDirectQueryService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardDirectQueryService.class);

    private final JdbcTemplate jdbc;
    private final ThingsBoardAuthService tbAuth;
    private final RestTemplate restTemplate = new RestTemplate();

    // Cache: vehicleId → ThingsBoard device entity ID (UUID)
    private final Map<String, String> deviceIdCache = new HashMap<>();

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
            List<Map<String, Object>> vehicles = fetchActiveVehicles(clientId);
            if (vehicles.isEmpty()) {
                log.info("[TB_DIRECT] No active vehicles found");
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

                    // Fetch telemetry from ThingsBoard
                    Map<String, Object> telemetry = fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, driverName);
                    if (telemetry != null) {
                        results.add(telemetry);
                    }
                } catch (Exception e) {
                    log.error("[TB_DIRECT] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
                }
            }

            log.info("[TB_DIRECT] Fetched live telemetry for {} vehicles", results.size());
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

            return fetchTelemetryFromThingsBoard(tbDeviceEntityId, vehicleId, null);

        } catch (Exception e) {
            log.error("[TB_DIRECT] Error fetching telemetry for vehicle={}: {}", vehicleId, e.getMessage());
            return null;
        }
    }

    private List<Map<String, Object>> fetchActiveVehicles(Long clientId) {
        try {
            String sql = clientId != null
                ? """
                  SELECT DISTINCT
                      t.vehicle_id,
                      dr.driver_name
                  FROM public.trips t
                  INNER JOIN public.drivers dr ON dr.id = t.driver_id
                  INNER JOIN public.vehicles v ON v.registration_no = t.vehicle_id
                  WHERE TRIM(t.status) NOT IN ('Completed', 'Cancelled')
                    AND t.vehicle_id IS NOT NULL
                    AND v.client_id = ?
                  ORDER BY t.vehicle_id
                  """
                : """
                  SELECT DISTINCT
                      t.vehicle_id,
                      dr.driver_name
                  FROM public.trips t
                  INNER JOIN public.drivers dr ON dr.id = t.driver_id
                  WHERE TRIM(t.status) NOT IN ('Completed', 'Cancelled')
                    AND t.vehicle_id IS NOT NULL
                  ORDER BY t.vehicle_id
                  """;

            return clientId != null ? jdbc.queryForList(sql, clientId) : jdbc.queryForList(sql);
        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchActiveVehicles failed: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveThingsBoardDeviceId(String vehicleId) {
        if (deviceIdCache.containsKey(vehicleId)) return deviceIdCache.get(vehicleId);

        try {
            String url = tbAuth.activeUrl() + "/api/tenant/devices?deviceName=" + vehicleId;
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
            String url = tbAuth.activeUrl()
                + "/api/tenant/devices?pageSize=100&page=0&textSearch=" + vehicleId;
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
    private Map<String, Object> fetchTelemetryFromThingsBoard(String entityId, String vehicleId, String driverName) {
        try {
            String url = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + entityId
                + "/values/timeseries?keys=lat,lng,speed,trip_status,overspeed,"
                + "smoking_status,mobile_usage,drowsiness_status,engine_rpm,battery_percentage";

            ResponseEntity<Map> res = restTemplate.exchange(
                url, HttpMethod.GET, tbAuth.authEntity(), Map.class);

            if (res.getBody() == null || res.getBody().isEmpty()) {
                return null;
            }

            Map<String, Object> data = res.getBody();

            // Check if telemetry is fresh (within 120 seconds)
            if (!isTelemetryFresh(data, vehicleId)) {
                return null;
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("vehicle_id", vehicleId);
            result.put("driver_name", driverName);
            result.put("lat", extractDouble(data, "lat"));
            result.put("lng", extractDouble(data, "lng"));
            result.put("speed", extractInt(data, "speed"));
            result.put("trip_status", extractString(data, "trip_status"));
            result.put("overspeed", extractString(data, "overspeed"));
            result.put("smoking_status", extractString(data, "smoking_status"));
            result.put("mobile_usage", extractString(data, "mobile_usage"));
            result.put("drowsiness_status", extractString(data, "drowsiness_status"));
            result.put("engine_rpm", extractInt(data, "engine_rpm"));
            result.put("battery_percentage", extractDouble(data, "battery_percentage"));

            return result;

        } catch (Exception e) {
            log.error("[TB_DIRECT] fetchTelemetryFromThingsBoard failed for vehicle={}: {}", vehicleId, e.getMessage());
            return null;
        }
    }

    private boolean isTelemetryFresh(Map<String, Object> data, String vehicleId) {
        try {
            for (String key : data.keySet()) {
                Long ts = extractTimestamp(data, key);
                if (ts != null) {
                    long tbTimeMs = ts;
                    long currentTimeMs = System.currentTimeMillis();
                    long ageSeconds = (currentTimeMs - tbTimeMs) / 1000;

                    if (ageSeconds > 120) {
                        return false;
                    }
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

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
}
