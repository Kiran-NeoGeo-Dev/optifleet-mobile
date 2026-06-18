package com.vts.controller;

import com.vts.entity.Client;
import com.vts.service.AuthService;
import com.vts.service.ThingsBoardDirectQueryService;
import com.vts.service.TripStateCache;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final AuthService  authService;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;
    private final TripStateCache tripStateCache;

    public NotificationController(AuthService authService,
                                   ThingsBoardDirectQueryService thingsBoardDirectQueryService,
                                   TripStateCache tripStateCache) {
        this.authService = authService;
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
        this.tripStateCache = tripStateCache;
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

        // 2. Route deviation alerts — only from live in-memory TripStateCache.
        // A deviation is only present in cache when ALL conditions are true:
        //   - An active trip with a valid OSRM route polyline exists
        //   - Fresh ThingsBoard telemetry was received (within 120 seconds)
        //   - The vehicle's actual GPS position is outside the route deviation threshold
        // Historical trip_alerts DB records are intentionally excluded.
        try {
            // TripStateCache exposes its internal map via allEntries()
            for (Map.Entry<String, TripStateCache.State> entry : tripStateCache.allEntries().entrySet()) {
                TripStateCache.State state = entry.getValue();
                if (state == null || state.lastPopup == null) continue;
                // Only include if cache is fresh (within 120 seconds)
                long ageSeconds = java.time.Duration.between(state.lastUpdateTime, java.time.Instant.now()).getSeconds();
                if (ageSeconds > 120) continue;
                // Only include if deviation is actually flagged in the live popup
                if (!"Yes".equalsIgnoreCase(state.lastPopup.getRouteDeviation())) continue;
                // Client scoping: skip vehicles not belonging to this client
                if (!isAdmin && cid != null && !cid.equals(state.clientId)) continue;

                results.add(buildNotif("live", state.vehicleId, state.driverName,
                    "ROUTE_DEVIATION", "Deviated from planned route",
                    state.lastLat, state.lastLng, new java.util.Date(), false));
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(results);
    }


    /**
     * Mark all notifications as resolved for the current client
     * NOTE: Notifications are queried directly from ThingsBoard in real-time.
     * Use dashboard UI to manage alerts and responses.
     */
    @PostMapping("/mark-all-read")
    public ResponseEntity<String> markAllRead() {
        return ResponseEntity.ok("Notifications are now queried directly from ThingsBoard in real-time");
    }

    /**
     * Clear all notifications for the current client
     * NOTE: Real-time notifications cannot be cleared. They are derived from live telemetry.
     */
    @PostMapping("/clear")
    public ResponseEntity<String> clearAll() {
        return ResponseEntity.ok("Notifications are now queried directly from ThingsBoard in real-time");
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
