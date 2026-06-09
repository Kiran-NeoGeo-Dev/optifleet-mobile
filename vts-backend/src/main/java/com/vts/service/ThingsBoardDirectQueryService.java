package com.vts.service;

import com.vts.model.TelemetryPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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
                + "smoking_status,mobile_usage,drowsiness_status,engine_rpm,battery_percentage,ignition_status";

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
            result.put("engineRpm", extractInt(data, "engine_rpm"));
            result.put("battery_percentage", extractDouble(data, "battery_percentage"));
            result.put("ignition_status", extractString(data, "ignition_status"));
            result.put("address", address);
            result.put("coordinates", coordinates);
            result.put("lastUpdateTime", lastUpdateTime);
            result.put("lastUpdateDate", lastUpdateDate);

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
                if (displayName != null) return displayName.toString();
            }
        } catch (Exception e) {
            log.debug("[TB_DIRECT] reverseGeocode failed for {},{}: {}", lat, lng, e.getMessage());
        }
        return String.format("%.6f, %.6f", lat, lng);
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
