package com.vts.controller;

import com.vts.entity.Client;
import com.vts.service.AuthService;
import com.vts.service.ThingsBoardDirectQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final AuthService  authService;
    private final JdbcTemplate jdbc;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public NotificationController(AuthService authService, JdbcTemplate jdbc, ThingsBoardDirectQueryService thingsBoardDirectQueryService) {
        this.authService = authService;
        this.jdbc        = jdbc;
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
    }

    /**
     * Returns currently active alerts from ThingsBoard directly.
     * Does NOT save to notifications table.
     * Queries ThingsBoard for live telemetry and checks alert values.
     * Admin → all vehicles. Client → only their vehicles.
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getNotifications() {
        Client  client  = authService.getCurrentClient();
        boolean isAdmin = client != null && "Admin".equalsIgnoreCase(client.getRole());
        Long    cid     = (client != null) ? client.getId() : null;

        List<Map<String, Object>> results = new ArrayList<>();

        // 1. Live telemetry alerts from ThingsBoard
        try {
            List<Map<String, Object>> telemetryData = thingsBoardDirectQueryService.fetchAllLiveTelemetry(isAdmin ? null : cid);
            String[][] alertFields = {
                { "overspeed",         "OVERSPEED",    "Overspeed detected"    },
                { "drowsiness_status", "DROWSINESS",   "Drowsiness detected"   },
                { "smoking_status",    "SMOKING",       "Smoking detected"      },
                { "mobile_usage",      "MOBILE_USAGE", "Mobile usage detected" },
            };
            for (Map<String, Object> row : telemetryData) {
                String vehicleId  = (String) row.get("vehicle_id");
                String driverName = (String) row.get("driver_name");
                Double lat = row.get("lat") != null ? ((Number) row.get("lat")).doubleValue() : null;
                Double lng = row.get("lng") != null ? ((Number) row.get("lng")).doubleValue() : null;
                for (String[] af : alertFields) {
                    String  field       = af[0];
                    String  alertType   = af[1];
                    String  description = af[2];
                    String  alertValue  = row.get(field) != null ? row.get(field).toString() : "";
                    boolean isActive    = field.equals("drowsiness_status")
                        ? alertValue.equalsIgnoreCase("fatigue") || alertValue.equalsIgnoreCase("yes")
                        : alertValue.equalsIgnoreCase("yes");
                    if (isActive) {
                        results.add(buildNotif("live", vehicleId, driverName,
                            alertType, description, lat, lng, new java.util.Date(), false));
                    }
                }
            }
        } catch (Exception ignored) {}

        // 2. Route deviation alerts from DB (last 24 hours)
        try {
            String sql = isAdmin
                ? """
                  SELECT ta.vehicle_id, ta.driver_name, ta.lat, ta.lng,
                         ta.description, ta.alerted_at, ta.is_resolved
                  FROM   public.trip_alerts ta
                  WHERE  ta.alert_type = 'ROUTE_DEVIATION'
                    AND  ta.alerted_at > NOW() - INTERVAL '24 hours'
                  ORDER  BY ta.alerted_at DESC
                  """
                : """
                  SELECT ta.vehicle_id, ta.driver_name, ta.lat, ta.lng,
                         ta.description, ta.alerted_at, ta.is_resolved
                  FROM   public.trip_alerts ta
                  WHERE  ta.alert_type = 'ROUTE_DEVIATION'
                    AND  ta.client_id  = ?
                    AND  ta.alerted_at > NOW() - INTERVAL '24 hours'
                  ORDER  BY ta.alerted_at DESC
                  """;
            List<Map<String, Object>> deviations = isAdmin
                ? jdbc.queryForList(sql)
                : jdbc.queryForList(sql, cid);
            for (Map<String, Object> row : deviations) {
                Double lat = row.get("lat") != null ? ((Number) row.get("lat")).doubleValue() : null;
                Double lng = row.get("lng") != null ? ((Number) row.get("lng")).doubleValue() : null;
                Object ts  = row.get("alerted_at");
                results.add(buildNotif("db",
                    row.get("vehicle_id"), row.get("driver_name"),
                    "ROUTE_DEVIATION", row.get("description") != null ? row.get("description").toString() : "Route deviation detected",
                    lat, lng,
                    ts instanceof java.sql.Timestamp ? new java.util.Date(((java.sql.Timestamp) ts).getTime()) : new java.util.Date(),
                    row.get("is_resolved")));
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(results);
    }

    /**
     * Mark all notifications as resolved for the current client
     * DISABLED - Not using notifications table anymore
     */
    // @PostMapping("/mark-all-read")
    public ResponseEntity<String> markAllRead() {
        return ResponseEntity.ok("Notifications are now queried directly from ThingsBoard");
    }

    /**
     * Clear all notifications for the current client
     * DISABLED - Not using notifications table anymore
     */
    // @PostMapping("/clear")
    public ResponseEntity<String> clearAll() {
        return ResponseEntity.ok("Notifications are now queried directly from ThingsBoard");
    }

    private Map<String, Object> buildNotif(String source, Object vehicleId, Object driverName,
                                            Object alertType, Object description,
                                            Object lat, Object lng,
                                            Object timestamp, Object isResolved) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("source",      source);
        n.put("vehicleId",   vehicleId);
        n.put("driverName",  driverName);
        n.put("alertType",   alertType);
        n.put("description", description);
        n.put("lat",         lat);
        n.put("lng",         lng);
        n.put("timestamp",   timestamp != null
            ? new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
                .format((java.util.Date) timestamp)
            : null);
        n.put("isResolved",  isResolved);
        n.put("key", vehicleId + "_" + alertType + "_"
            + (timestamp != null ? String.valueOf(((java.util.Date) timestamp).getTime()) : String.valueOf(System.nanoTime())));
        return n;
    }
}
