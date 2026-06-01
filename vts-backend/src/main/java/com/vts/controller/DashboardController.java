package com.vts.controller;

import com.vts.dto.DashboardResponse;
import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.entity.Vehicle;
import com.vts.model.VehiclePopupData;
import com.vts.service.AuthService;
import com.vts.service.DashboardService;
import com.vts.service.DriverService;
import com.vts.service.ThingsBoardDirectQueryService;
import com.vts.service.TripStateCache;
import com.vts.service.VehicleService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final DriverService    driverService;
    private final VehicleService   vehicleService;
    private final TripStateCache   tripStateCache;
    private final AuthService      authService;
    private final JdbcTemplate     jdbc;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public DashboardController(
            DashboardService dashboardService,
            DriverService driverService,
            VehicleService vehicleService,
            TripStateCache tripStateCache,
            AuthService authService,
            JdbcTemplate jdbc,
            ThingsBoardDirectQueryService thingsBoardDirectQueryService
    ) {
        this.dashboardService = dashboardService;
        this.driverService    = driverService;
        this.vehicleService   = vehicleService;
        this.tripStateCache   = tripStateCache;
        this.authService      = authService;
        this.jdbc             = jdbc;
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
    }

    @GetMapping("/summary")
    public ResponseEntity<DashboardResponse> getSummary() {
        return ResponseEntity.ok(dashboardService.getDashboardForCurrentClient());
    }

    @GetMapping("/drivers")
    public ResponseEntity<List<Driver>> listDriversForDashboard() {
        return ResponseEntity.ok(driverService.getAllDrivers());
    }

    @GetMapping("/vehicles")
    public ResponseEntity<List<Vehicle>> listVehiclesForDashboard() {
        return ResponseEntity.ok(vehicleService.getAllVehicles());
    }

    /**
     * Returns live vehicle positions for the dashboard map.
     * Shows ONLY vehicles with:
     * 1. Active trip (not Completed/Cancelled)
     * 2. LIVE telemetry from ThingsBoard (within 120 seconds)
     * Queries ThingsBoard directly instead of vehicle_tracking table.
     * Admin → all vehicles. Client → only their vehicles.
     */
    @GetMapping("/live-vehicles")
    public ResponseEntity<List<Map<String, Object>>> getLiveVehicles() {
        Client  client  = authService.getCurrentClient();
        boolean isAdmin = client != null && "Admin".equalsIgnoreCase(client.getRole());
        Long    cid     = client != null ? client.getId() : null;

        List<Map<String, Object>> result = new ArrayList<>();

        try {
            // Query ThingsBoard directly for live telemetry
            List<Map<String, Object>> telemetryData = thingsBoardDirectQueryService.fetchAllLiveTelemetry(isAdmin ? null : cid);

            for (Map<String, Object> row : telemetryData) {
                String vid = (String) row.get("vehicle_id");
                if (vid == null || row.get("lat") == null || row.get("lng") == null) continue;

                double lat = row.get("lat") != null ? ((Number) row.get("lat")).doubleValue() : 0;
                double lng = row.get("lng") != null ? ((Number) row.get("lng")).doubleValue() : 0;
                double spd = row.get("speed") != null ? ((Number) row.get("speed")).doubleValue() : 0;

                VehiclePopupData popup = new VehiclePopupData();
                popup.setVehicleId(vid);
                popup.setStatus(row.get("trip_status") != null ? row.get("trip_status").toString() : "Idle");
                popup.setDriverName(row.get("driver_name") != null ? row.get("driver_name").toString() : "");
                popup.setSpeed(String.valueOf((int) spd));
                popup.setLat(lat);
                popup.setLng(lng);
                popup.setOverspeed(row.get("overspeed") != null ? row.get("overspeed").toString() : "No");
                popup.setSmoking(row.get("smoking_status") != null ? row.get("smoking_status").toString() : "No");
                popup.setMobileUsage(row.get("mobile_usage") != null ? row.get("mobile_usage").toString() : "No");
                popup.setDrowsiness(row.get("drowsiness_status") != null ? row.get("drowsiness_status").toString() : "Normal");
                popup.setRouteDeviation("No");

                result.add(buildVehicleEntry(vid, lat, lng, spd, popup.getDriverName(), popup));
            }
        } catch (Exception e) {
            // return empty on error
        }
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> buildVehicleEntry(String vehicleId, double lat, double lng,
                                                   double speed, String driverName, VehiclePopupData popup) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("vehicleId",   vehicleId);
        m.put("lat",         lat);
        m.put("lng",         lng);
        m.put("speed",       speed);
        m.put("driverName",  driverName);
        if (popup != null) {
            m.put("tripStatus",     popup.getStatus());
            m.put("overspeed",      popup.getOverspeed());
            m.put("smoking",        popup.getSmoking());
            m.put("mobileUsage",    popup.getMobileUsage());
            m.put("drowsiness",     popup.getDrowsiness());
            m.put("routeDeviation", popup.getRouteDeviation());
        }
        return m;
    }
}
