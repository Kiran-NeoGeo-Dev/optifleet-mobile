package com.vts.controller;

import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.service.AuthService;
import com.vts.service.DriverService;
import com.vts.service.ThingsBoardDirectQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/fleet/drivers")
public class FleetDriverController {

    private static final Logger log = LoggerFactory.getLogger(FleetDriverController.class);

    // Configurable event weights
    private static final int W_SMOKING      = 5;
    private static final int W_MOBILE       = 5;
    private static final int W_OVERSPEED    = 5;
    private static final int W_DROWSY       = 5;
    private static final int W_SEATBELT     = 5;
    private static final int W_DISTRACTION  = 5;
    private static final int W_HARSH_BRAKE  = 5;
    private static final int W_HARSH_ACCEL  = 5;
    private static final int W_RASH_TURN    = 5;
    private static final int W_YAWN_ALERT   = 5;

    private final DriverService                 driverService;
    private final ThingsBoardDirectQueryService tbQuery;
    private final AuthService                   authService;
    private final JdbcTemplate                  jdbc;

    public FleetDriverController(DriverService driverService,
                                 ThingsBoardDirectQueryService tbQuery,
                                 AuthService authService,
                                 JdbcTemplate jdbc) {
        this.driverService = driverService;
        this.tbQuery       = tbQuery;
        this.authService   = authService;
        this.jdbc          = jdbc;
    }

    // ── GET /api/fleet/drivers ────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getFleetDrivers() {
        Client  client       = authService.getCurrentClient();
        boolean isSuperAdmin = authService.isSuperAdmin(client);
        boolean isOrgAdmin   = authService.isAdmin(client);
        Long    cid          = client != null ? client.getId() : null;
        Long    orgId        = client != null ? client.getOrgId() : null;

        List<Driver> drivers = driverService.getDriversForCurrentRole();

        Map<Long, String>   driverIdToVehicle    = buildDriverIdToVehicleMap(isSuperAdmin, isOrgAdmin, cid, orgId);
        Map<Long, String>   driverIdToModel      = buildDriverIdToVehicleModelMap(isSuperAdmin, isOrgAdmin, cid, orgId);
        Map<String, String> liveStatus           = fetchLiveStatusMap(isSuperAdmin, isOrgAdmin, cid, orgId);
        Map<String, Double> vehicleScores = fetchLatestScoresByVehicle();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Driver d : drivers) {
            String vehicleReg   = driverIdToVehicle.get(d.getId());
            String vehicleModel = driverIdToModel.get(d.getId());
            
            // CRITICAL FIX: Determine actual trip status and active state
            String tripStatus;
            boolean active;
            
            if (vehicleReg != null && liveStatus.containsKey(vehicleReg.toUpperCase())) {
                // Vehicle is in live telemetry list - use its actual status
                tripStatus = liveStatus.get(vehicleReg.toUpperCase());
                active = "Moving".equalsIgnoreCase(tripStatus) || "Idle".equalsIgnoreCase(tripStatus);
                log.debug("[FLEET_DRIVER] Driver {} (vehicle={}) → ACTIVE (tripStatus={})", d.getDriverName(), vehicleReg, tripStatus);
            } else {
                // Vehicle is NOT in live telemetry list = OFFLINE (INACTIVE in ThingsBoard or telemetry > 120s old)
                tripStatus = vehicleReg != null ? "Offline" : "Parked";
                active = false; // Driver is inactive when vehicle is offline
                log.debug("[FLEET_DRIVER] Driver {} (vehicle={}) → INACTIVE (not in live telemetry)", d.getDriverName(), vehicleReg != null ? vehicleReg : "NONE");
            }

            Double rawScore = vehicleReg != null
                    ? vehicleScores.getOrDefault(vehicleReg.toUpperCase(), null)
                    : null;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id",           d.getId());
            entry.put("driverName",   d.getDriverName());
            entry.put("phoneNumber",  d.getPhoneNumber());
            entry.put("photoFront",   d.getFrontFaceImage());
            entry.put("vehicleRegNo", vehicleReg);
            entry.put("vehicleModel", vehicleModel);
            entry.put("tripStatus",   tripStatus);
            entry.put("active",       active);
            entry.put("safetyScore",  rawScore);
            entry.put("clientId",     d.getClientId());
            result.add(entry);
        }
        return ResponseEntity.ok(result);
    }

    // ── GET /api/fleet/drivers/{id}/scorecard?period=month&year=2025&month=6 ──
    @GetMapping("/{id}/scorecard")
    public ResponseEntity<Map<String, Object>> getScorecard(
            @PathVariable Long id,
            @RequestParam(defaultValue = "month") String period,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {

        Driver driver     = driverService.getDriver(id);
        Client  client               = authService.getCurrentClient();
        boolean isSuperAdmin         = authService.isSuperAdmin(client);
        boolean isOrgAdmin           = authService.isAdmin(client);
        Long    cid                  = client != null ? client.getId()    : null;
        Long    orgId                = client != null ? client.getOrgId() : null;
        Map<Long, String> driverIdToVehicle      = buildDriverIdToVehicleMap(isSuperAdmin, isOrgAdmin, cid, orgId);
        Map<Long, String> driverIdToVehicleModel = buildDriverIdToVehicleModelMap(isSuperAdmin, isOrgAdmin, cid, orgId);
        String vehicleReg   = driverIdToVehicle.get(id);
        String vehicleModel = driverIdToVehicleModel.get(id);

        // Resolve year/month for monthly period
        java.time.LocalDate now = java.time.LocalDate.now();
        int resolvedYear  = (year  != null) ? year  : now.getYear();
        int resolvedMonth = (month != null) ? month : now.getMonthValue();

        Map<String, Object> events = fetchEventsByDriverMonth(id, vehicleReg, resolvedYear, resolvedMonth);
        Double rawScore = calcRawScore(events);
        String remark   = rawScore != null ? getRemark(rawScore) : null;

        log.info("[SCORECARD] Driver ID={}, Year={}, Month={}, kmDriven={}, rawScore={}, remark={}", 
            id, resolvedYear, resolvedMonth, events.get("kmDriven"), rawScore, remark);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driverId",     id);
        result.put("driverName",   driver.getDriverName());
        result.put("phoneNumber",  driver.getPhoneNumber());
        result.put("photoFront",   driver.getFrontFaceImage());
        result.put("vehicleRegNo", vehicleReg);
        result.put("vehicleModel", vehicleModel);
        result.put("period",       resolvedYear + "-" + String.format("%02d", resolvedMonth));
        result.put("safetyScore",  rawScore);
        result.put("remark",       remark);
        result.put("events",       events);
        
        log.info("[SCORECARD] Response for driver {}: safetyScore={}, events.kmDriven={}", 
            id, rawScore, events.get("kmDriven"));
        
        return ResponseEntity.ok(result);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Map<Long, String> buildDriverIdToVehicleModelMap(boolean isSuperAdmin, boolean isOrgAdmin, Long cid, Long orgId) {
        Map<Long, String> map = new HashMap<>();
        try {
            String sql;
            List<Map<String, Object>> rows;
            if (isSuperAdmin) {
                sql = "SELECT a.driver_id, v.vehicle_model FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id WHERE a.status = true ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql);
            } else if (isOrgAdmin) {
                sql = "SELECT a.driver_id, v.vehicle_model FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                      "WHERE a.status = true AND v.org_id = ? ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql, orgId);
            } else {
                sql = "SELECT a.driver_id, v.vehicle_model FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                      "WHERE a.status = true AND a.client_id = ? ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql, cid);
            }
            for (Map<String, Object> row : rows) {
                Object did   = row.get("driver_id");
                Object model = row.get("vehicle_model");
                if (did != null)
                    map.putIfAbsent(((Number) did).longValue(), model != null ? model.toString() : null);
            }
        } catch (Exception ignored) {}
        return map;
    }

    private Map<Long, String> buildDriverIdToVehicleMap(boolean isSuperAdmin, boolean isOrgAdmin, Long cid, Long orgId) {
        Map<Long, String> map = new HashMap<>();
        try {
            String sql;
            List<Map<String, Object>> rows;
            if (isSuperAdmin) {
                sql = "SELECT a.driver_id, v.registration_no FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id WHERE a.status = true ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql);
            } else if (isOrgAdmin) {
                sql = "SELECT a.driver_id, v.registration_no FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                      "WHERE a.status = true AND v.org_id = ? ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql, orgId);
            } else {
                sql = "SELECT a.driver_id, v.registration_no FROM public.associations a " +
                      "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                      "WHERE a.status = true AND a.client_id = ? ORDER BY a.id DESC";
                rows = jdbc.queryForList(sql, cid);
            }
            for (Map<String, Object> row : rows) {
                Object did = row.get("driver_id");
                Object reg = row.get("registration_no");
                if (did != null && reg != null)
                    map.putIfAbsent(((Number) did).longValue(), reg.toString());
            }
        } catch (Exception ignored) {}
        return map;
    }

    private Map<String, String> fetchLiveStatusMap(boolean isSuperAdmin, boolean isOrgAdmin, Long cid, Long orgId) {
        Map<String, String> map = new HashMap<>();
        try {
            List<Map<String, Object>> tel;
            if (isSuperAdmin) {
                tel = tbQuery.fetchAllLiveTelemetry(null, null);
            } else if (isOrgAdmin) {
                tel = tbQuery.fetchAllLiveTelemetry(null, orgId);
            } else {
                tel = tbQuery.fetchAllLiveTelemetry(cid, null);
            }
            for (Map<String, Object> row : tel) {
                String vid = (String) row.get("vehicle_id");
                String st  = row.get("trip_status") != null ? row.get("trip_status").toString() : "Parked";
                if (vid != null) map.put(vid.toUpperCase(), st);
            }
        } catch (Exception ignored) {}
        return map;
    }

    /**
     * Fetch monthly rawScore per vehicle for the fleet list (current month).
     * Queries vtelemetry and trips separately to avoid dropping vehicles with no trip join.
     */
    private Map<String, Double> fetchLatestScoresByVehicle() {
        Map<String, Double> scores = new HashMap<>();
        try {
            java.time.LocalDate now = java.time.LocalDate.now();
            int y = now.getYear(), m = now.getMonthValue();

            // Step 1: get event weights per vehicle from tb_device_telemetry (varchar columns)
            // Handle telemetry_time as VARCHAR format: 'DD-MM-YYYY HH24:MI:SS'
            String eventSql =
                "SELECT UPPER(vehicle_id) AS vid, " +
                "  COALESCE(SUM(CASE WHEN smoking_status     ILIKE 'Yes' THEN " + W_SMOKING     + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN mobile_usage       ILIKE 'Yes' THEN " + W_MOBILE      + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN overspeed          ILIKE 'Yes' THEN " + W_OVERSPEED   + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN drowsiness_status  ILIKE 'Fatigue' THEN " + W_DROWSY   + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN seatbelt_status    ILIKE 'No'  THEN " + W_SEATBELT    + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN distraction_status ILIKE 'Yes' THEN " + W_DISTRACTION + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN harsh_braking      ILIKE 'Yes' THEN " + W_HARSH_BRAKE + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN harsh_acceleration ILIKE 'Yes' THEN " + W_HARSH_ACCEL + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN rash_turning       ILIKE 'Yes' THEN " + W_RASH_TURN   + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN yawn_alert         ILIKE 'Yes' THEN " + W_YAWN_ALERT  + " ELSE 0 END),0) AS total_weight " +
                "FROM public.tb_device_telemetry " +
                "WHERE vehicle_id IS NOT NULL " +
                "  AND (CASE " +
                "    WHEN telemetry_time ~ '^\\d{2}-\\d{2}-\\d{4}\\s+' " +
                "      THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS') " +
                "    ELSE telemetry_time::timestamptz " +
                "  END) >= make_timestamptz(?, ?, 1, 0, 0, 0, 'Asia/Kolkata') " +
                "  AND (CASE " +
                "    WHEN telemetry_time ~ '^\\d{2}-\\d{2}-\\d{4}\\s+' " +
                "      THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS') " +
                "    ELSE telemetry_time::timestamptz " +
                "  END) < make_timestamptz(?, ?, 1, 0, 0, 0, 'Asia/Kolkata') + INTERVAL '1 month' " +
                "GROUP BY UPPER(vehicle_id)";

            List<Map<String, Object>> eventRows = jdbc.queryForList(eventSql, y, m, y, m);

            // Step 2: get driver km_travelled ONLY if updated_at matches current month
            String kmSql =
                "SELECT UPPER(v.registration_no) AS vid, " +
                "  CASE " +
                "    WHEN EXTRACT(YEAR FROM d.updated_at) = ? AND EXTRACT(MONTH FROM d.updated_at) = ? " +
                "      THEN COALESCE(d.km_travelled, 0) " +
                "    ELSE 0 " +
                "  END AS km_driven " +
                "FROM public.associations a " +
                "JOIN public.drivers d ON d.id = a.driver_id " +
                "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                "WHERE a.status = true AND v.registration_no IS NOT NULL";

            Map<String, Double> kmByVehicle = new HashMap<>();
            for (Map<String, Object> row : jdbc.queryForList(kmSql, y, m)) {
                String vid = row.get("vid") != null ? row.get("vid").toString() : null;
                double km  = row.get("km_driven") != null ? ((Number) row.get("km_driven")).doubleValue() : 0;
                if (vid != null) kmByVehicle.put(vid, km);
            }

            // Step 3: combine — only store a score when km > 0 (real trip data exists)
            for (Map<String, Object> row : eventRows) {
                String vid    = row.get("vid")          != null ? row.get("vid").toString()                        : null;
                double weight = row.get("total_weight") != null ? ((Number) row.get("total_weight")).doubleValue() : 0;
                double km     = vid != null ? kmByVehicle.getOrDefault(vid, 0.0) : 0.0;
                if (vid != null) {
                    Double score = calcSafetyScore(weight, km);
                    if (score != null) scores.put(vid, score);
                }
            }
            // Also add vehicles that have km but no telemetry events (perfect score)
            for (Map.Entry<String, Double> kmEntry : kmByVehicle.entrySet()) {
                if (kmEntry.getValue() > 0 && !scores.containsKey(kmEntry.getKey())) {
                    scores.put(kmEntry.getKey(), 100.0);
                }
            }
        } catch (Exception ignored) {}
        return scores;
    }

    /**
     * Fetch event counts + KM driven for a specific year/month.
     * KM Driven = public.drivers.km_travelled ONLY if updated_at matches the requested month.
     * This returns the km_travelled value that was recorded in that specific month.
     */
    private Map<String, Object> fetchEventsByDriverMonth(Long driverId, String vehicleRegNo, int year, int month) {
        // Fetch km_travelled ONLY if updated_at is in the requested month
        // This ensures we get the KM for the specific month being viewed
        Double km = 0.0;
        try {
            km = jdbc.queryForObject(
                "SELECT CASE " +
                "  WHEN EXTRACT(YEAR FROM updated_at) = ? AND EXTRACT(MONTH FROM updated_at) = ? " +
                "    THEN COALESCE(km_travelled, 0) " +
                "  ELSE 0 " +
                "END " +
                "FROM public.drivers WHERE id = ?",
                Double.class, year, month, driverId);
            log.info("[SCORECARD] Driver ID={} for {}-{} has monthly km_travelled={} (filtered by updated_at)", 
                driverId, year, month, km);
        } catch (Exception e) {
            log.error("[SCORECARD] Error fetching km_travelled for driver {}: {}", driverId, e.getMessage(), e);
        }
        
        // If no vehicle registration, return empty events but WITH correct km_travelled
        if (vehicleRegNo == null) {
            log.warn("[SCORECARD] No vehicle for driver {}, returning empty events with km={}", driverId, km);
            Map<String, Object> result = emptyEvents();
            result.put("kmDriven", km != null ? km : 0.0);
            return result;
        }
        
        try {
            // Handle telemetry_time as VARCHAR format: 'DD-MM-YYYY HH24:MI:SS'
            // If it's already timestamp, the CASE will work with ::timestamptz
            String sql =
                "SELECT " +
                "  COALESCE(SUM(CASE WHEN smoking_status     ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS smoking, " +
                "  COALESCE(SUM(CASE WHEN mobile_usage       ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS mobile, " +
                "  COALESCE(SUM(CASE WHEN overspeed          ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS overspeed, " +
                "  COALESCE(SUM(CASE WHEN drowsiness_status  ILIKE 'Fatigue' THEN 1 ELSE 0 END),0) AS drowsiness, " +
                "  COALESCE(SUM(CASE WHEN seatbelt_status    ILIKE 'No'     THEN 1 ELSE 0 END),0) AS seatbelt, " +
                "  COALESCE(SUM(CASE WHEN distraction_status ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS distraction, " +
                "  COALESCE(SUM(CASE WHEN harsh_braking      ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS harsh_braking, " +
                "  COALESCE(SUM(CASE WHEN harsh_acceleration ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS harsh_acceleration, " +
                "  COALESCE(SUM(CASE WHEN rash_turning       ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS rash_turning, " +
                "  COALESCE(SUM(CASE WHEN yawn_alert         ILIKE 'Yes'    THEN 1 ELSE 0 END),0) AS yawn_alert " +
                "FROM public.tb_device_telemetry " +
                "WHERE UPPER(vehicle_id) = UPPER(?) " +
                "  AND (CASE " +
                "    WHEN telemetry_time ~ '^\\d{2}-\\d{2}-\\d{4}\\s+' " +
                "      THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS') " +
                "    ELSE telemetry_time::timestamptz " +
                "  END) >= make_timestamptz(?, ?, 1, 0, 0, 0, 'Asia/Kolkata') " +
                "  AND (CASE " +
                "    WHEN telemetry_time ~ '^\\d{2}-\\d{2}-\\d{4}\\s+' " +
                "      THEN to_timestamp(telemetry_time, 'DD-MM-YYYY HH24:MI:SS') " +
                "    ELSE telemetry_time::timestamptz " +
                "  END) < make_timestamptz(?, ?, 1, 0, 0, 0, 'Asia/Kolkata') + INTERVAL '1 month'";

            Map<String, Object> row = jdbc.queryForMap(sql, vehicleRegNo, year, month, year, month);

            log.info("[SCORECARD] Driver ID={}, vehicleRegNo={}, kmDriven={}", driverId, vehicleRegNo, km);

            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("smoking",            toLong(row.get("smoking")));
            ev.put("mobile",             toLong(row.get("mobile")));
            ev.put("overspeed",          toLong(row.get("overspeed")));
            ev.put("drowsiness",         toLong(row.get("drowsiness")));
            ev.put("seatbelt",           toLong(row.get("seatbelt")));
            ev.put("distraction",        toLong(row.get("distraction")));
            ev.put("harshBraking",       toLong(row.get("harsh_braking")));
            ev.put("harshAcceleration",  toLong(row.get("harsh_acceleration")));
            ev.put("rashTurning",        toLong(row.get("rash_turning")));
            ev.put("yawnAlert",          toLong(row.get("yawn_alert")));
            ev.put("kmDriven",           km != null ? km : 0.0);
            
            log.info("[SCORECARD] Events for driver {}: kmDriven={}, events={}", driverId, km, ev);
            
            return ev;
        } catch (Exception e) {
            log.error("[SCORECARD] Error fetching telemetry events for driver {}: {}", driverId, e.getMessage(), e);
            // Return empty events but WITH correct km_travelled
            Map<String, Object> result = emptyEvents();
            result.put("kmDriven", km != null ? km : 0.0);
            return result;
        }
    }

    private Map<String, Object> emptyEvents() {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("smoking", 0L); e.put("mobile", 0L); e.put("overspeed", 0L);
        e.put("drowsiness", 0L); e.put("seatbelt", 0L); e.put("distraction", 0L);
        e.put("harshBraking", 0L); e.put("harshAcceleration", 0L); e.put("rashTurning", 0L);
        e.put("yawnAlert", 0L);
        e.put("kmDriven", 0.0);
        return e;
    }

    private Double calcRawScore(Map<String, Object> events) {
        long   smoking     = toLong(events.get("smoking"));
        long   mobile      = toLong(events.get("mobile"));
        long   overspeed   = toLong(events.get("overspeed"));
        long   drowsy      = toLong(events.get("drowsiness"));
        long   seatbelt    = toLong(events.get("seatbelt"));
        long   distraction = toLong(events.get("distraction"));
        long   harshBrake  = toLong(events.get("harshBraking"));
        long   harshAccel  = toLong(events.get("harshAcceleration"));
        long   rashTurn    = toLong(events.get("rashTurning"));
        long   yawnAlert   = toLong(events.get("yawnAlert"));
        double km          = toDouble(events.get("kmDriven"));

        double weight = (smoking * W_SMOKING) + (mobile * W_MOBILE)
                      + (overspeed * W_OVERSPEED) + (drowsy * W_DROWSY)
                      + (seatbelt * W_SEATBELT) + (distraction * W_DISTRACTION)
                      + (harshBrake * W_HARSH_BRAKE) + (harshAccel * W_HARSH_ACCEL)
                      + (rashTurn * W_RASH_TURN) + (yawnAlert * W_YAWN_ALERT);
        return calcSafetyScore(weight, km);
    }

    /**
     * Safety Score = 100 - (totalPenaltyWeight / kmDriven * 100), clamped 0–100.
     * Returns null when km = 0 (no trip data — score is not applicable).
     */
    private Double calcSafetyScore(double weight, double km) {
        if (km <= 0) return null;
        double penalty = (weight / km) * 100.0;
        return Math.max(0.0, Math.min(100.0, 100.0 - penalty));
    }

    /**
     * Rating: 95-100=Excellent, 90-<95=Very Good, 85-<90=Good,
     * 80-<85=Fair, 75-<80=Poor, <75=Need Improvement
     */
    private String getRemark(double score) {
        if (score >= 95) return "Excellent";
        if (score >= 90) return "Very Good";
        if (score >= 85) return "Good";
        if (score >= 80) return "Fair";
        if (score >= 75) return "Poor";
        return "Need Improvement";
    }

    private long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number) return ((Number) v).longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return 0L; }
    }

    private double toDouble(Object v) {
        if (v == null) return 0.0;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return 0.0; }
    }
}
