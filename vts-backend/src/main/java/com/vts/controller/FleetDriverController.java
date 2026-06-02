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
    private static final int W_SMOKING   = 2;
    private static final int W_MOBILE    = 5;
    private static final int W_OVERSPEED = 5;
    private static final int W_DROWSY    = 5;
    private static final int W_SEATBELT  = 5;

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
        Client  client  = authService.getCurrentClient();
        boolean isAdmin = client != null && "Admin".equalsIgnoreCase(client.getRole());
        Long    cid     = client != null ? client.getId() : null;

        List<Driver> drivers = driverService.getDriversForCurrentRole();

        Map<Long, String>   driverIdToVehicle = buildDriverIdToVehicleMap(isAdmin, cid);
        Map<String, String> liveStatus        = fetchLiveStatusMap(isAdmin, cid);
        Map<String, Double> vehicleScores     = fetchLatestScoresByVehicle("today");

        List<Map<String, Object>> result = new ArrayList<>();
        for (Driver d : drivers) {
            String vehicleReg = driverIdToVehicle.get(d.getId());
            String tripStatus = vehicleReg != null
                    ? liveStatus.getOrDefault(vehicleReg.toUpperCase(), "Parked")
                    : "Parked";
            boolean active = "Moving".equalsIgnoreCase(tripStatus) || "Idle".equalsIgnoreCase(tripStatus);

            // rawScore: lower = safer driver
            double rawScore = vehicleReg != null
                    ? vehicleScores.getOrDefault(vehicleReg.toUpperCase(), 0.0)
                    : 0.0;

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id",           d.getId());
            entry.put("driverName",   d.getDriverName());
            entry.put("phoneNumber",  d.getPhoneNumber());
            entry.put("photoFront",   d.getFrontFaceImage());
            entry.put("vehicleRegNo", vehicleReg);
            entry.put("tripStatus",   tripStatus);
            entry.put("active",       active);
            entry.put("safetyScore",  rawScore);   // rawScore 0-N (lower=better)
            entry.put("clientId",     d.getClientId());
            result.add(entry);
        }
        return ResponseEntity.ok(result);
    }

    // ── GET /api/fleet/drivers/{id}/scorecard?period=today|yesterday|week ────
    @GetMapping("/{id}/scorecard")
    public ResponseEntity<Map<String, Object>> getScorecard(
            @PathVariable Long id,
            @RequestParam(defaultValue = "today") String period) {

        Driver driver     = driverService.getDriver(id);
        Map<Long, String> driverIdToVehicle = buildDriverIdToVehicleMap(true, null);
        String vehicleReg = driverIdToVehicle.get(id);

        Map<String, Object> events      = fetchEventsByVehicle(vehicleReg, period);
        Map<String, Object> todayEv     = fetchEventsByVehicle(vehicleReg, "today");
        Map<String, Object> yesterdayEv = fetchEventsByVehicle(vehicleReg, "yesterday");
        Map<String, Object> weekEv      = fetchEventsByVehicle(vehicleReg, "week");

        double rawScore = calcRawScore(events);
        String remark   = getRemark(rawScore);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("driverId",        id);
        result.put("driverName",      driver.getDriverName());
        result.put("phoneNumber",     driver.getPhoneNumber());
        result.put("photoFront",      driver.getFrontFaceImage());
        result.put("vehicleRegNo",    vehicleReg);
        result.put("period",          period);
        result.put("safetyScore",     rawScore);   // 0 = perfect, higher = worse
        result.put("remark",          remark);
        result.put("events",          events);
        result.put("todayEvents",     todayEv);
        result.put("yesterdayEvents", yesterdayEv);
        result.put("weekEvents",      weekEv);
        return ResponseEntity.ok(result);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Map<Long, String> buildDriverIdToVehicleMap(boolean isAdmin, Long cid) {
        Map<Long, String> map = new HashMap<>();
        try {
            String sql = isAdmin
                ? "SELECT a.driver_id, v.registration_no FROM public.associations a " +
                  "JOIN public.vehicles v ON v.id = a.vehicle_id WHERE a.status = true ORDER BY a.id DESC"
                : "SELECT a.driver_id, v.registration_no FROM public.associations a " +
                  "JOIN public.vehicles v ON v.id = a.vehicle_id " +
                  "WHERE a.status = true AND a.client_id = ? ORDER BY a.id DESC";
            List<Map<String, Object>> rows = isAdmin
                    ? jdbc.queryForList(sql)
                    : jdbc.queryForList(sql, cid);
            for (Map<String, Object> row : rows) {
                Object did = row.get("driver_id");
                Object reg = row.get("registration_no");
                if (did != null && reg != null)
                    map.putIfAbsent(((Number) did).longValue(), reg.toString());
            }
        } catch (Exception ignored) {}
        return map;
    }

    private Map<String, String> fetchLiveStatusMap(boolean isAdmin, Long cid) {
        Map<String, String> map = new HashMap<>();
        try {
            List<Map<String, Object>> tel = tbQuery.fetchAllLiveTelemetry(isAdmin ? null : cid);
            for (Map<String, Object> row : tel) {
                String vid = (String) row.get("vehicle_id");
                String st  = row.get("trip_status") != null ? row.get("trip_status").toString() : "Parked";
                if (vid != null) map.put(vid.toUpperCase(), st);
            }
        } catch (Exception ignored) {}
        return map;
    }

    /**
     * Fetch rawScore per vehicle for the fleet list display (uses same period logic).
     * rawScore = (totalWeight / kmDriven) * 100 per spec.
     * 0 = no violations = best score.
     */
    private Map<String, Double> fetchLatestScoresByVehicle(String period) {
        Map<String, Double> scores = new HashMap<>();
        try {
            String dateFilter = buildDateFilter(period);
            String sql =
                "SELECT UPPER(vehicle_id) AS vid, " +
                "  COALESCE(SUM(CASE WHEN smoking_status  = true                                      THEN " + W_SMOKING   + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN mobile_usage    = true                                      THEN " + W_MOBILE    + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN overspeed       = true                                      THEN " + W_OVERSPEED + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN drowsiness_status = 'Fatigue'                              THEN " + W_DROWSY    + " ELSE 0 END),0) +" +
                "  COALESCE(SUM(CASE WHEN seatbelt_status = false                                     THEN " + W_SEATBELT  + " ELSE 0 END),0) AS total_weight," +
                "  COALESCE(SUM(COALESCE(speed,0) * 0.25), 0) AS km_driven " +
                "FROM public.vtelemetry WHERE vehicle_id IS NOT NULL AND " + dateFilter +
                " GROUP BY UPPER(vehicle_id)";

            List<Map<String, Object>> rows = jdbc.queryForList(sql);
            for (Map<String, Object> row : rows) {
                String vid    = row.get("vid")          != null ? row.get("vid").toString()                         : null;
                double weight = row.get("total_weight") != null ? ((Number) row.get("total_weight")).doubleValue()  : 0;
                double km     = row.get("km_driven")    != null ? ((Number) row.get("km_driven")).doubleValue()     : 0;
                if (vid != null) scores.put(vid, calcRawFromWeightKm(weight, km));
            }
        } catch (Exception ignored) {}
        return scores;
    }

    private Map<String, Object> fetchEventsByVehicle(String vehicleRegNo, String period) {
        if (vehicleRegNo == null) return emptyEvents();
        try {
            String dateFilter = buildDateFilter(period);
            String sql =
                "SELECT " +
                "  COALESCE(SUM(CASE WHEN smoking_status  = true                                      THEN 1 ELSE 0 END),0) AS smoking, " +
                "  COALESCE(SUM(CASE WHEN mobile_usage    = true                                      THEN 1 ELSE 0 END),0) AS mobile, " +
                "  COALESCE(SUM(CASE WHEN overspeed       = true                                      THEN 1 ELSE 0 END),0) AS overspeed, " +
                "  COALESCE(SUM(CASE WHEN drowsiness_status = 'Fatigue'                              THEN 1 ELSE 0 END),0) AS drowsiness, " +
                "  COALESCE(SUM(CASE WHEN seatbelt_status = false                                     THEN 1 ELSE 0 END),0) AS seatbelt, " +
                "  COALESCE(SUM(COALESCE(speed,0) * 0.25), 0) AS km_driven " +
                "FROM public.vtelemetry WHERE UPPER(vehicle_id) = UPPER(?) AND " + dateFilter;

            Map<String, Object> row = jdbc.queryForMap(sql, vehicleRegNo);
            Map<String, Object> ev  = new LinkedHashMap<>();
            ev.put("smoking",    toLong(row.get("smoking")));
            ev.put("mobile",     toLong(row.get("mobile")));
            ev.put("overspeed",  toLong(row.get("overspeed")));
            ev.put("drowsiness", toLong(row.get("drowsiness")));
            ev.put("seatbelt",   toLong(row.get("seatbelt")));
            ev.put("kmDriven",   toDouble(row.get("km_driven")));
            return ev;
        } catch (Exception e) {
            return emptyEvents();
        }
    }

    /**
     * Build date filter using ONLY created_at (database source of truth).
     * Filters records by their actual event timestamp, not insertion time.
     * 
     * Today:     DATE(created_at) = CURRENT_DATE
     * Yesterday: DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
     * Week:      created_at >= DATE_TRUNC('week', CURRENT_DATE)
     */
    private String buildDateFilter(String period) {
        String p = period.toLowerCase();
        if ("yesterday".equals(p)) {
            return "DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'";
        } else if ("week".equals(p)) {
            return "created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        } else {
            // today
            return "DATE(created_at) = CURRENT_DATE";
        }
    }

    private Map<String, Object> emptyEvents() {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("smoking", 0L); e.put("mobile", 0L); e.put("overspeed", 0L);
        e.put("drowsiness", 0L); e.put("seatbelt", 0L); e.put("kmDriven", 0.0);
        return e;
    }

    private double calcRawScore(Map<String, Object> events) {
        long   smoking   = toLong(events.get("smoking"));
        long   mobile    = toLong(events.get("mobile"));
        long   overspeed = toLong(events.get("overspeed"));
        long   drowsy    = toLong(events.get("drowsiness"));
        long   seatbelt  = toLong(events.get("seatbelt"));
        double km        = toDouble(events.get("kmDriven"));

        double weight = (smoking * W_SMOKING) + (mobile * W_MOBILE)
                      + (overspeed * W_OVERSPEED) + (drowsy * W_DROWSY) + (seatbelt * W_SEATBELT);
        return calcRawFromWeightKm(weight, km);
    }

    /**
     * rawScore = (weight / km) * 100 per spec.
     * 0 = perfect driver, higher = more violations per km.
     * If km = 0 but weight > 0, use weight directly as raw score.
     * If weight = 0, rawScore = 0 (perfect).
     */
    private double calcRawFromWeightKm(double weight, double km) {
        if (weight == 0) return 0.0;
        if (km <= 0) return weight; // no distance data, use raw weight
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
