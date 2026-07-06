package com.vts.service;

import com.vts.config.ThingsBoardConfig;
import com.vts.model.*;
import com.vts.utils.HaversineDistance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class LiveTrackingService {

    private static final Logger log = LoggerFactory.getLogger(LiveTrackingService.class);
    private static final String WS_TOPIC = "/topic/live-tracking/";

    private final JdbcTemplate          jdbc;
    private final ThingsBoardConfig     config;
    private final HaversineDistance     haversine;
    private final TripStateCache        cache;
    private final SimpMessagingTemplate ws;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public LiveTrackingService(JdbcTemplate jdbc, ThingsBoardConfig config,
                               HaversineDistance haversine, TripStateCache cache,
                               SimpMessagingTemplate ws,
                               ThingsBoardDirectQueryService thingsBoardDirectQueryService) {
        this.jdbc      = jdbc;
        this.config    = config;
        this.haversine = haversine;
        this.cache     = cache;
        this.ws        = ws;
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
    }

    /**
     * TWO CONDITIONS (trip is optional — used for route/progress only):
     *  1. ThingsBoard vehicle_id  →  vehicles.registration_no
     *  2. Association exists      →  associations (status=true)
     *  Trip is queried if it exists, but NOT required for telemetry processing.
     */
    public LiveTrackingUpdate processTelemetry(TelemetryPayload p) {
        if (p.getVehicleId() == null || p.getLat() == null || p.getLng() == null) return null;
        String vid = p.getVehicleId();

        // ── CONDITION 1: vehicle exists ──────────────────────────────────────
        Map<String, Object> vData = queryVehicle(vid);
        if (vData == null) { log.warn("C1 FAIL: {} not in vehicles", vid); return null; }
        Long vehicleDbId = toLong(vData.get("vehicle_db_id"));
        Long clientId    = toLong(vData.get("client_id"));
        Long driverId    = toLong(vData.get("driver_id"));
        String driverName = (String) vData.get("driver_name");

        // ── CONDITION 2: association valid ───────────────────────────────────
        if (!assocValid(vehicleDbId, clientId)) { log.warn("C2 FAIL: no assoc for {}", vid); return null; }

        // ── CONDITION 3 (optional): active trip for route/progress ───────────
        Map<String, Object> tripData = queryTrip(vid, clientId);

        log.info("CONDITIONS PASSED → live tracking: {} (trip={})", vid, tripData != null ? tripData.get("trip_id") : "none");

        // ── Init or get in-memory state ───────────────────────────────────────
        TripStateCache.State state = cache.get(vid);
        if (state == null || (tripData != null && !String.valueOf(tripData.get("trip_id")).equals(state.tripId))) {
            // New state or trip changed — reinitialise
            String polyJson = tripData != null && tripData.get("custom_polyline") != null
                ? tripData.get("custom_polyline").toString() : null;
            List<RoutePoint> full = haversine.parsePolyline(polyJson);
            double totalM = haversine.calculateRouteDistance(full);

            state = new TripStateCache.State();
            state.vehicleId          = vid;
            state.tripId             = tripData != null ? (String) tripData.get("trip_id") : null;
            state.clientId           = clientId;
            state.driverName         = driverName;
            state.fullRoute          = full;
            state.remainingRoute     = full;
            state.currentPointIndex  = 0;
            state.totalDistanceM     = totalM;
            state.remainingDistanceM = totalM;
            state.lastSpeedKmh       = p.getSpeed() != null ? p.getSpeed() : 0;
            state.lastUpdateTime     = Instant.now();
            cache.put(vid, state);
        }

        double speed = p.getSpeed() != null ? p.getSpeed() : 0;
        state.lastSpeedKmh   = speed;
        state.lastLat        = p.getLat();
        state.lastLng        = p.getLng();
        state.lastUpdateTime = Instant.now();

        // ── Find nearest route point → shrink polyline ────────────────────────
        HaversineDistance.NearestPointResult nearest =
            haversine.findNearestPointOnRoute(state.fullRoute, p.getLat(), p.getLng());
        double deviationM = nearest.minDistance;

        if (nearest.nearestIndex > state.currentPointIndex) {
            state.currentPointIndex  = nearest.nearestIndex;
            state.remainingDistanceM = haversine.calculateRemainingDistance(
                state.fullRoute, nearest.nearestIndex);
            state.remainingRoute     = haversine.getRemainingRoute(
                state.fullRoute, nearest.nearestIndex);
        }

        // ── Route deviation check ─────────────────────────────────────────────
        // Only evaluate deviation when an active trip with a valid OSRM route exists
        boolean deviated = false;
        if (tripData != null && state.fullRoute != null && !state.fullRoute.isEmpty()) {
            deviated = deviationM > config.getDeviationThreshold();
            if (deviated) saveDeviationAlert(vid, driverName, clientId, p.getLat(), p.getLng(), deviationM);
        }

        // ── Auto-update trip status based on actual progress ──────────────────
        if (tripData != null && state.tripId != null) {
            autoUpdateTripStatus(state.tripId, speed, state.progressPct(), state.totalDistanceM);
        }

        // ── Persist telemetry ─────────────────────────────────────────────────
        saveTelemetry(vid, driverName, clientId, p);

        // ── Build popup ───────────────────────────────────────────────────────
        VehiclePopupData popup = buildPopup(p, driverName, clientId, deviated);
        state.lastPopup = popup;  // store for REST polling

        // ── Build WebSocket update ────────────────────────────────────────────
        LiveTrackingUpdate update = new LiveTrackingUpdate();
        update.setVehicleId(vid);
        update.setLat(p.getLat());
        update.setLng(p.getLng());
        update.setSpeed(speed);
        update.setTripStatus(p.getTripStatus() != null ? p.getTripStatus() : "Moving");
        update.setRemainingRoute(state.remainingRoute);
        update.setRemainingDistanceKm(state.remainingDistanceM / 1000.0);
        update.setEtaMinutes(state.etaMinutes());
        update.setProgressPercentage(state.progressPct());
        update.setPopupData(popup);
        update.setDeviating(deviated);
        update.setDeviationDistance(deviationM);
        update.setTimestamp(Instant.now().toEpochMilli());

        // ── Broadcast via WebSocket ───────────────────────────────────────────
        ws.convertAndSend(WS_TOPIC + vid, update);
        log.info("WS sent: {} | {}% | {}km rem | ETA {}min",
            vid,
            String.format("%.1f", state.progressPct()),
            String.format("%.1f", state.remainingDistanceM / 1000.0),
            String.format("%.0f", state.etaMinutes()));

        return update;
    }

    public LiveTrackingUpdate getCurrentState(String vehicleId) {
        if (!thingsBoardDirectQueryService.isVehicleLive(vehicleId)) {
            log.info("getCurrentState: {} is offline by ThingsBoard state/telemetry age", vehicleId);
            return null;
        }

        // ── Try cache first ─────────────────────────────────────────────────────
        TripStateCache.State state = cache.get(vehicleId);
        if (state != null) {
            // Check if cache is stale (older than 120 seconds)
            long ageSeconds = java.time.Duration.between(state.lastUpdateTime, Instant.now()).getSeconds();
            if (ageSeconds < 120) {
                LiveTrackingUpdate u = new LiveTrackingUpdate();
                u.setVehicleId(vehicleId);
                u.setLat(state.lastLat);
                u.setLng(state.lastLng);
                u.setSpeed(state.lastSpeedKmh);
                u.setRemainingRoute(state.remainingRoute);
                u.setRemainingDistanceKm(state.remainingDistanceM / 1000.0);
                u.setEtaMinutes(state.etaMinutes());
                u.setProgressPercentage(state.progressPct());
                u.setPopupData(state.lastPopup);
                u.setTimestamp(Instant.now().toEpochMilli());
                return u;
            }
        }

        // ── Cache miss or stale — query ThingsBoard directly ───────────────────
        try {
            Map<String, Object> telemetry = thingsBoardDirectQueryService.fetchSingleVehicleTelemetry(vehicleId);
            if (telemetry != null) {
                Double lat   = telemetry.get("lat")   != null ? ((Number) telemetry.get("lat")).doubleValue()   : 0;
                Double lng   = telemetry.get("lng")   != null ? ((Number) telemetry.get("lng")).doubleValue()   : 0;
                Double speed = telemetry.get("speed") != null ? ((Number) telemetry.get("speed")).doubleValue() : 0;
                String tripStatus = telemetry.get("trip_status") != null ? telemetry.get("trip_status").toString() : "Moving";
                String driverName = telemetry.get("driver_name") != null ? telemetry.get("driver_name").toString() : "";

                // ── Route/progress/ETA calculation from DB trip ───────────────
                List<RoutePoint> full       = List.of();
                double           totalM     = 0;
                double           remainingM = 0;
                double           progressPct = 0;
                double           etaMins     = 0;
                boolean          deviated   = false;
                List<RoutePoint> remaining  = List.of();

                try {
                    Map<String, Object> tripRow = jdbc.queryForMap("""
                        SELECT custom_polyline::text AS custom_polyline
                        FROM   public.trips
                        WHERE  vehicle_id = ?
                          AND  TRIM(status) NOT IN ('Completed', 'Cancelled')
                        ORDER  BY created_at DESC LIMIT 1
                        """, vehicleId);
                    String polyJson = tripRow.get("custom_polyline") != null
                        ? tripRow.get("custom_polyline").toString() : null;
                    full    = haversine.parsePolyline(polyJson);
                    totalM  = haversine.calculateRouteDistance(full);

                    if (!full.isEmpty() && (lat != 0 || lng != 0)) {
                        HaversineDistance.NearestPointResult nearest =
                            haversine.findNearestPointOnRoute(full, lat, lng);
                        remainingM  = haversine.calculateRemainingDistance(full, nearest.nearestIndex);
                        remaining   = haversine.getRemainingRoute(full, nearest.nearestIndex);
                        // Only flag deviation if a valid active trip with a route exists
                        deviated    = nearest.minDistance > config.getDeviationThreshold();
                        if (totalM > 0) progressPct = ((totalM - remainingM) / totalM) * 100.0;
                        if (speed > 0) etaMins = (remainingM / (speed / 3.6)) / 60.0;
                    } else {
                        remaining  = full;
                        remainingM = totalM;
                        deviated   = false; // no route = no deviation
                    }
                } catch (Exception ex) {
                    log.debug("getCurrentState trip query failed for {}: {}", vehicleId, ex.getMessage());
                    remaining  = full;
                    remainingM = totalM;
                }

                String address     = thingsBoardDirectQueryService.reverseGeocode(lat, lng);
                String coordinates = String.format("%.6f, %.6f", lat, lng);
                java.time.ZoneId zone       = java.time.ZoneId.of("Asia/Kolkata");
                java.time.Instant tsInstant = Instant.now();
                String lastUpdateTime = java.time.format.DateTimeFormatter.ofPattern("hh:mm a").withZone(zone).format(tsInstant);
                String lastUpdateDate = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone).format(tsInstant);
                if (telemetry.get("lastUpdateTime") instanceof String s && !s.isEmpty()) lastUpdateTime = s;
                if (telemetry.get("lastUpdateDate") instanceof String s && !s.isEmpty()) lastUpdateDate = s;
                if (telemetry.get("address")        instanceof String s && !s.isEmpty()) address = s;

                VehiclePopupData popup = new VehiclePopupData();
                popup.setVehicleId(vehicleId);
                popup.setStatus(tripStatus);
                popup.setDriverName(driverName);
                popup.setSpeed(String.valueOf(speed.intValue()));
                popup.setLocation(coordinates);
                popup.setOverspeed(telemetry.get("overspeed")          != null ? telemetry.get("overspeed").toString()         : "No");
                popup.setSmoking(telemetry.get("smoking_status")       != null ? telemetry.get("smoking_status").toString()    : "No");
                popup.setMobileUsage(telemetry.get("mobile_usage")     != null ? telemetry.get("mobile_usage").toString()      : "No");
                popup.setDrowsiness(telemetry.get("drowsiness_status") != null ? telemetry.get("drowsiness_status").toString() : "Normal");
                popup.setHarshBraking(telemetry.get("harsh_braking")   != null ? telemetry.get("harsh_braking").toString()   : "No");
                popup.setHarshAcceleration(telemetry.get("harsh_acceleration") != null ? telemetry.get("harsh_acceleration").toString() : "No");
                popup.setRashTurning(telemetry.get("rash_turning")     != null ? telemetry.get("rash_turning").toString()     : "No");
                popup.setRouteDeviation(deviated ? "Yes" : "No");
                popup.setLat(lat);
                popup.setLng(lng);
                popup.setAddress(address);
                popup.setCoordinates(coordinates);
                popup.setLastUpdateTime(lastUpdateTime);
                popup.setLastUpdateDate(lastUpdateDate);

                LiveTrackingUpdate u = new LiveTrackingUpdate();
                u.setVehicleId(vehicleId);
                u.setLat(lat);
                u.setLng(lng);
                u.setSpeed(speed);
                u.setTripStatus(tripStatus);
                u.setRemainingRoute(remaining);
                u.setRemainingDistanceKm(remainingM / 1000.0);
                u.setEtaMinutes(etaMins);
                u.setProgressPercentage(progressPct);
                u.setPopupData(popup);
                u.setDeviating(deviated);
                u.setDeviationDistance(deviated ? haversine.findNearestPointOnRoute(full, lat, lng).minDistance : 0);
                u.setTimestamp(Instant.now().toEpochMilli());
                return u;
            }
        } catch (Exception e) {
            log.debug("getCurrentState ThingsBoard query failed for {}: {}", vehicleId, e.getMessage());
        }

        // ── Final fallback: DB trip data only (no live telemetry) ─────────────
        // No DB fallback here: returning trip start coordinates without live ThingsBoard
        // validation makes offline vehicles appear live in Admin/User/Driver maps.
        return null;
    }

    // ── DB helpers ────────────────────────────────────────────────────────────

    private Map<String, Object> queryVehicle(String regNo) {
        try {
            return jdbc.queryForMap("""
                SELECT v.id AS vehicle_db_id, v.client_id,
                       a.driver_id, d.driver_name
                FROM   public.vehicles v
                INNER JOIN public.associations a ON a.vehicle_id = v.id AND a.status = true
                INNER JOIN public.drivers d      ON d.id = a.driver_id
                WHERE  v.registration_no = ?
                LIMIT  1
                """, regNo);
        } catch (Exception e) { return null; }
    }

    private boolean assocValid(Long vehicleDbId, Long clientId) {
        Integer cnt = jdbc.queryForObject(
            "SELECT COUNT(*) FROM public.associations WHERE vehicle_id=? AND status=true",
            Integer.class, vehicleDbId);
        return cnt != null && cnt > 0;
    }

    private Map<String, Object> queryTrip(String vehicleId, Long clientId) {
        try {
            return jdbc.queryForMap("""
                SELECT trip_id, status, custom_polyline::text AS custom_polyline
                FROM   public.trips
                WHERE  vehicle_id = ?
                  AND  TRIM(status) NOT IN ('Completed', 'Cancelled')
                ORDER  BY created_at DESC LIMIT 1
                """, vehicleId);
        } catch (Exception e) { return null; }
    }

    /**
     * Auto-transition trip status based on vehicle movement:
     *   Not Started / Delayed → In Progress  (vehicle is moving, speed > 2 km/h)
     *   In Progress / Delayed → Completed    (progress >= 98%)
     *   Not Started / In Progress → Delayed  (time-based, set by TripDelayScheduler)
     */
    private void autoUpdateTripStatus(String tripId, double speedKmh, double progressPct, double totalDistanceM) {
        try {
            String current = jdbc.queryForObject(
                "SELECT status FROM public.trips WHERE trip_id=?", String.class, tripId);
            if (current == null) return;
            current = current.trim();

            String next = current;
            // Destination reached — highest priority, overrides Delayed too
            if (("In Progress".equals(current) || "Delayed".equals(current))
                    && progressPct >= 98.0 && totalDistanceM > 0) {
                next = "Completed";
            } else if (("Not Started".equals(current) || "Delayed".equals(current)) && speedKmh > 2) {
                next = "In Progress";
            }

            if (!next.equals(current)) {
                jdbc.update("UPDATE public.trips SET status=?, updated_at=NOW() WHERE trip_id=?", next, tripId);
                log.info("Trip {} status auto-updated: {} -> {}", tripId, current, next);
            }
        } catch (Exception e) { log.warn("autoUpdateTripStatus failed: {}", e.getMessage()); }
    }

    private void saveTelemetry(String vid, String driverName, Long clientId, TelemetryPayload p) {
        try {
            jdbc.update("""
                INSERT INTO public.vehicle_tracking
                (vehicle_id,driver_name,lat,lng,speed,trip_status,engine_rpm,overspeed,
                 drowsiness_status,smoking_status,mobile_usage,battery_percentage,client_id,created_by,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'system',NOW())
                """,
                vid, driverName, p.getLat(), p.getLng(), p.getSpeed(), p.getTripStatus(),
                p.getEngineRpm(), p.getOverspeed(), p.getDrowsinessStatus(),
                p.getSmokingStatus(), p.getMobileUsage(), p.getBatteryPercentage(), clientId);
        } catch (Exception e) { log.warn("saveTelemetry failed: {}", e.getMessage()); }
    }

    private void saveDeviationAlert(String vid, String driverName, Long clientId,
                                    double lat, double lng, double deviation) {
        try {
            // Only insert if no alert for this vehicle in the last 60 minutes
            Integer recent = jdbc.queryForObject("""
                SELECT COUNT(*) FROM public.trip_alerts
                WHERE  vehicle_id = ? AND alert_type = 'ROUTE_DEVIATION'
                  AND  alerted_at > NOW() - INTERVAL '60 minutes'
                """, Integer.class, vid);
            if (recent != null && recent > 0) return;

            jdbc.update("""
                INSERT INTO public.trip_alerts
                (vehicle_id,driver_name,alert_type,lat,lng,description,alerted_at,is_resolved,client_id,created_by)
                VALUES (?,?,'ROUTE_DEVIATION',?,?,?,NOW(),false,?,'system')
                """,
                vid, driverName, lat, lng,
                String.format("Deviated %.0fm from planned route", deviation), clientId);
        } catch (Exception e) { log.warn("saveDeviationAlert failed: {}", e.getMessage()); }
    }

    private VehiclePopupData buildPopup(TelemetryPayload p, String driverName,
                                        Long clientId, boolean deviated) {
        double lat = p.getLat();
        double lng = p.getLng();
        String address     = thingsBoardDirectQueryService.reverseGeocode(lat, lng);
        String coordinates = String.format("%.6f, %.6f", lat, lng);
        java.time.Instant now = java.time.Instant.now();
        java.time.ZoneId zone = java.time.ZoneId.of("Asia/Kolkata");
        String lastUpdateTime = java.time.format.DateTimeFormatter.ofPattern("hh:mm a").withZone(zone).format(now);
        String lastUpdateDate = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(zone).format(now);

        VehiclePopupData popup = new VehiclePopupData();
        popup.setVehicleId(p.getVehicleId());
        popup.setStatus(p.getTripStatus() != null ? p.getTripStatus() : "Idle");
        popup.setDriverName(driverName != null ? driverName : "Unknown");
        popup.setSpeed(p.getSpeed() != null ? String.valueOf(p.getSpeed().intValue()) : "0");
        popup.setLocation(coordinates);
        popup.setOverspeed(p.getOverspeed()        != null ? p.getOverspeed()        : "No");
        popup.setSmoking(p.getSmokingStatus()      != null ? p.getSmokingStatus()    : "No");
        popup.setMobileUsage(p.getMobileUsage()    != null ? p.getMobileUsage()      : "No");
        popup.setDrowsiness(p.getDrowsinessStatus()!= null ? p.getDrowsinessStatus() : "Normal");
        popup.setHarshBraking(p.getHarshBraking()  != null ? p.getHarshBraking()    : "No");
        popup.setHarshAcceleration(p.getHarshAcceleration() != null ? p.getHarshAcceleration() : "No");
        popup.setRashTurning(p.getRashTurning()    != null ? p.getRashTurning()      : "No");
        popup.setRouteDeviation(deviated ? "Yes" : "No");
        popup.setLat(lat);
        popup.setLng(lng);
        popup.setClientId(clientId);
        popup.setAddress(address);
        popup.setCoordinates(coordinates);
        popup.setLastUpdateTime(lastUpdateTime);
        popup.setLastUpdateDate(lastUpdateDate);
        popup.setTimestamp(now.toEpochMilli());
        return popup;
    }

    private Long toLong(Object o) {
        if (o == null) return null;
        return ((Number) o).longValue();
    }
}
