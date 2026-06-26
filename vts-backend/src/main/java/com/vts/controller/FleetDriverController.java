package com.vts.controller;

import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.repository.AssociationRepository;
import com.vts.service.AuthService;
import com.vts.service.DriverService;
import com.vts.service.ThingsBoardDirectQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/fleet/drivers")
public class FleetDriverController {

    // Configurable event weights
    private static final int W_SMOKING     = 5;
    private static final int W_MOBILE      = 5;
    private static final int W_OVERSPEED   = 5;
    private static final int W_DROWSY      = 5;
    private static final int W_SEATBELT    = 5;
    private static final int W_DISTRACTION = 5;

    private final DriverService                 driverService;
    private final AssociationRepository         assocRepo;
    private final ThingsBoardDirectQueryService tbQuery;
    private final AuthService                   authService;
    private final JdbcTemplate                  jdbc;

    public FleetDriverController(DriverService driverService,
                                 AssociationRepository assocRepo,
                                 ThingsBoardDirectQueryService tbQuery,
                                 AuthService authService,
                                 JdbcTemplate jdbc) {
        this.driverService = driverService;
        this.assocRepo     = assocRepo;
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
        Map<String, Double> vehicleScores        = fetchLatestScoresByVehicle("month");

        List<Map<String, Object>> result = new ArrayList<>();
        for (Driver d : drivers) {
            String vehicleReg   = driverIdToVehicle.get(d.getId());
            String vehicleModel = driverIdToModel.get(d.getId());
            String tripStatus   = vehicleReg != null
                    ? liveStatus.getOrDefault(vehicleReg.toUpperCase(), "Parked")
                    : "Parked";
            boolean active = "Moving".equalsIgnoreCase(tripStatus) || "Idle".equalsIgnoreCase(tripStatus);

            double rawScore = vehicleReg != null
                    ? vehicleScores.getOrDefault(vehicleReg.toUpperCase(), 0.0)
                    : 0.0;

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
        Map<Long, String> driverIdToVehicle      = buildDriverIdToVehicleMap(true, false, null, null);
        Map<Long, String> driverIdToVehicleModel = buildDriverIdToVehicleModelMap(true, false, null, null);
        String vehicleReg   = driverIdToVehicle.get(id);
        String vehicleModel = driverIdToVehicleModel.get(id);

        // Resolve year/month for monthly period
        java.time.LocalDate now = java.time.LocalDate.now();
        int resolvedYear  = (year  != null) ? year  : now.getYear();
        int resolvedMonth = (month != null) ? month : now.getMonthValue();

        Map<String, Object> events = fetchEventsByVehicleMonth(vehicleReg, resolvedYear, resolvedMonth);
        double rawScore = calcRawScore(events);
        String remark   = getRemark(rawScore);

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
    private Map<String, Double> fetchLatestScoresByVehicle(String period) {
        Map<String, Double> scores = new HashMap<>();
        try {
            java.time.LocalDate now = java.time.LocalDate.now();
            int y = now.getYear(), m = now.getMonthValue();

            // Step 1: get event weights per vehicle from vtelemetry (boolean columns, month filter on created_at)
            String eventSql =
                "SELECT UPPER(vehicle_id) AS vid, " +
                "  COALESCE(SUM(CASE WHEN smoking_status     = true      THEN " + W_SMOKING     + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN mobile_usage       = true      THEN " + W_MOBILE      + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN overspeed          = true      THEN " + W_OVERSPEED   + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN drowsiness_status  = 'Fatigue' THEN " + W_DROWSY      + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN seatbelt_status    = false     THEN " + W_SEATBELT    + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN distraction_status = true      THEN " + W_DISTRACTION + " ELSE 0 END),0) AS total_weight " +
                "FROM public.vtelemetry " +
                "WHERE vehicle_id IS NOT NULL " +
                "  AND EXTRACT(YEAR  FROM created_at) = ? " +
                "  AND EXTRACT(MONTH FROM created_at) = ? " +
                "GROUP BY UPPER(vehicle_id)";

            List<Map<String, Object>> eventRows = jdbc.queryForList(eventSql, y, m);

            // Step 2: get total km per vehicle from trips — only vehicle_id + distance_km, no date filter
            String kmSql =
                "SELECT UPPER(vehicle_id) AS vid, COALESCE(SUM(distance_km), 0) AS km_driven " +
                "FROM public.trips " +
                "WHERE vehicle_id IS NOT NULL " +
                "GROUP BY UPPER(vehicle_id)";

            Map<String, Double> kmByVehicle = new HashMap<>();
            for (Map<String, Object> row : jdbc.queryForList(kmSql)) {
                String vid = row.get("vid") != null ? row.get("vid").toString() : null;
                double km  = row.get("km_driven") != null ? ((Number) row.get("km_driven")).doubleValue() : 0;
                if (vid != null) kmByVehicle.put(vid, km);
            }

            // Step 3: combine
            for (Map<String, Object> row : eventRows) {
                String vid    = row.get("vid")          != null ? row.get("vid").toString()                        : null;
                double weight = row.get("total_weight") != null ? ((Number) row.get("total_weight")).doubleValue() : 0;
                double km     = vid != null ? kmByVehicle.getOrDefault(vid, 0.0) : 0.0;
                if (vid != null) scores.put(vid, calcRawFromWeightKm(weight, km));
            }
        } catch (Exception ignored) {}
        return scores;
    }

    /**
     * Fetch event counts + KM driven for a specific year/month.
     * KM Driven = SUM(public.trips.distance_km) for completed trips in the month.
     */
    private Map<String, Object> fetchEventsByVehicleMonth(String vehicleRegNo, int year, int month) {
        if (vehicleRegNo == null) return emptyEvents();
        try {
            String sql =
                "SELECT " +
                "  COALESCE(SUM(CASE WHEN smoking_status     = true      THEN 1 ELSE 0 END),0) AS smoking, " +
                "  COALESCE(SUM(CASE WHEN mobile_usage       = true      THEN 1 ELSE 0 END),0) AS mobile, " +
                "  COALESCE(SUM(CASE WHEN overspeed          = true      THEN 1 ELSE 0 END),0) AS overspeed, " +
                "  COALESCE(SUM(CASE WHEN drowsiness_status  = 'Fatigue' THEN 1 ELSE 0 END),0) AS drowsiness, " +
                "  COALESCE(SUM(CASE WHEN seatbelt_status    = false     THEN 1 ELSE 0 END),0) AS seatbelt, " +
                "  COALESCE(SUM(CASE WHEN distraction_status = true      THEN 1 ELSE 0 END),0) AS distraction " +
                "FROM public.vtelemetry " +
                "WHERE UPPER(vehicle_id) = UPPER(?) " +
                "  AND EXTRACT(YEAR  FROM created_at) = ? " +
                "  AND EXTRACT(MONTH FROM created_at) = ?";

            Map<String, Object> row = jdbc.queryForMap(sql, vehicleRegNo, year, month);

            // KM from trips — only vehicle_id + distance_km, no date filter per spec
            Double km = jdbc.queryForObject(
                "SELECT COALESCE(SUM(distance_km), 0) FROM public.trips " +
                "WHERE UPPER(vehicle_id) = UPPER(?)",
                Double.class, vehicleRegNo);

            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("smoking",     toLong(row.get("smoking")));
            ev.put("mobile",      toLong(row.get("mobile")));
            ev.put("overspeed",   toLong(row.get("overspeed")));
            ev.put("drowsiness",  toLong(row.get("drowsiness")));
            ev.put("seatbelt",    toLong(row.get("seatbelt")));
            ev.put("distraction", toLong(row.get("distraction")));
            ev.put("kmDriven",    km != null ? km : 0.0);
            return ev;
        } catch (Exception e) {
            return emptyEvents();
        }
    }

    private Map<String, Object> emptyEvents() {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("smoking", 0L); e.put("mobile", 0L); e.put("overspeed", 0L);
        e.put("drowsiness", 0L); e.put("seatbelt", 0L); e.put("distraction", 0L); e.put("kmDriven", 0.0);
        return e;
    }

    private double calcRawScore(Map<String, Object> events) {
        long   smoking     = toLong(events.get("smoking"));
        long   mobile      = toLong(events.get("mobile"));
        long   overspeed   = toLong(events.get("overspeed"));
        long   drowsy      = toLong(events.get("drowsiness"));
        long   seatbelt    = toLong(events.get("seatbelt"));
        long   distraction = toLong(events.get("distraction"));
        double km          = toDouble(events.get("kmDriven"));

        double weight = (smoking * W_SMOKING) + (mobile * W_MOBILE)
                      + (overspeed * W_OVERSPEED) + (drowsy * W_DROWSY)
                      + (seatbelt * W_SEATBELT) + (distraction * W_DISTRACTION);
        return calcRawFromWeightKm(weight, km);
    }

    /**
     * rawScore = (weight / km) * 100 per spec.
     * If km = 0 and weight = 0 → 0.0 (perfect).
     * If km = 0 but weight > 0 → no trip distance data, return 0 (no score possible).
     */
    private double calcRawFromWeightKm(double weight, double km) {
        if (weight == 0) return 0.0;
        if (km <= 0)     return 0.0; // no trip km data for this period — cannot score
        return (weight / km) * 100.0;
    }

    /**
     * Spec remark table: rawScore 0-2=Excellent, 2-4=Very Good, 4-6=Good,
     * 6-8=Fair, 8-10=Poor, >10=Very Poor
     */
    private String getRemark(double rawScore) {
        if (rawScore <= 2)  return "Excellent";
        if (rawScore <= 4)  return "Very Good";
        if (rawScore <= 6)  return "Good";
        if (rawScore <= 8)  return "Fair";
        if (rawScore <= 10) return "Poor";
        return "Very Poor";
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
