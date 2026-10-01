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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private static final Logger log = LoggerFactory.getLogger(DashboardController.class);

    private final DashboardService dashboardService;
    private final DriverService    driverService;
    private final VehicleService   vehicleService;
    private final TripStateCache   tripStateCache;
    private final AuthService      authService;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public DashboardController(
            DashboardService dashboardService,
            DriverService driverService,
            VehicleService vehicleService,
            TripStateCache tripStateCache,
            AuthService authService,
            ThingsBoardDirectQueryService thingsBoardDirectQueryService
    ) {
        this.dashboardService = dashboardService;
        this.driverService    = driverService;
        this.vehicleService   = vehicleService;
        this.tripStateCache   = tripStateCache;
        this.authService      = authService;
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
     * Returns vehicle positions for the dashboard map.
     * Shows ALL vehicles allowed for the logged-in user (Super Admin/Admin/User), including:
     * 1. ACTIVE vehicles with live telemetry from ThingsBoard (within 120 seconds)
     * 2. INACTIVE vehicles at their last received lat/lng location with last telemetry timestamp
     * 
     * Inactive vehicles are display-only based on last telemetry. They do NOT trigger
     * movement-based alarms, notifications, or other live-data actions from stale lat/lng.
     * 
     * Admin → all vehicles. Client → only their vehicles.
     */
    @GetMapping("/live-vehicles")
    public ResponseEntity<List<Map<String, Object>>> getLiveVehicles() {
        log.info("[DASHBOARD] getLiveVehicles() called");
        Client  client       = authService.getCurrentClient();
        boolean isSuperAdmin = authService.isSuperAdmin(client);
        boolean isOrgAdmin   = authService.isAdmin(client);
        Long    cid          = client != null ? client.getId() : null;
        Long    orgId        = client != null ? client.getOrgId() : null;

        // Pre-load vehicles currently deviating from live in-memory cache (fresh <=120s, active trip+route required)
        // IMPORTANT: Only consider deviation for ACTIVE vehicles with recent telemetry
        java.util.Set<String> deviatedVehicles = new java.util.HashSet<>();
        try {
            for (Map.Entry<String, TripStateCache.State> entry : tripStateCache.allEntries().entrySet()) {
                TripStateCache.State st = entry.getValue();
                if (st == null || st.lastPopup == null) continue;
                long ageSeconds = java.time.Duration.between(st.lastUpdateTime, java.time.Instant.now()).getSeconds();
                if (ageSeconds > 120) continue; // Only consider fresh telemetry for deviation
                if (!isSuperAdmin && !isOrgAdmin && cid != null && !cid.equals(st.clientId)) continue;
                if ("Yes".equalsIgnoreCase(st.lastPopup.getRouteDeviation())) {
                    deviatedVehicles.add(st.vehicleId);
                }
            }
        } catch (Exception ignored) {}
        
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            // Fetch ALL vehicles including inactive ones with last known location
            List<Map<String, Object>> telemetryData;
            if (isSuperAdmin) {
                telemetryData = thingsBoardDirectQueryService.fetchAllVehicleTelemetryIncludingInactive(null, null);
            } else if (isOrgAdmin) {
                telemetryData = thingsBoardDirectQueryService.fetchAllVehicleTelemetryIncludingInactive(null, orgId);
            } else {
                telemetryData = thingsBoardDirectQueryService.fetchAllVehicleTelemetryIncludingInactive(cid, null);
            }
            
            log.info("[DASHBOARD] Received {} vehicle telemetry records", telemetryData.size());
            
            for (Map<String, Object> row : telemetryData) {
                String vid = (String) row.get("vehicle_id");
                if (vid == null || row.get("lat") == null || row.get("lng") == null) continue;
                
                double lat = ((Number) row.get("lat")).doubleValue();
                double lng = ((Number) row.get("lng")).doubleValue();
                double spd = row.get("speed") != null ? ((Number) row.get("speed")).doubleValue() : 0;
                boolean isActive = row.get("isActive") != null ? (Boolean) row.get("isActive") : false;
                
                String lastUpdateTime = row.get("lastUpdateTime") != null ? row.get("lastUpdateTime").toString() : "";
                String lastUpdateDate = row.get("lastUpdateDate") != null ? row.get("lastUpdateDate").toString() : "";

                log.debug("[DASHBOARD] Processing vehicle={} lastUpdateTime='{}' lastUpdateDate='{}'", 
                    vid, lastUpdateTime, lastUpdateDate);

                VehiclePopupData popup = new VehiclePopupData();
                popup.setVehicleId(vid);
                // CRITICAL FIX: trip_status is already determined by ThingsBoardDirectQueryService
                // based on isActive flag. Just use it directly - no re-evaluation needed.
                String tripStatus = row.get("trip_status") != null ? row.get("trip_status").toString() : "Offline";
                
                // DEFENSIVE LOGGING: Log the final status being sent to frontend
                if (isActive) {
                    log.debug("[DASHBOARD_MAP] Vehicle {} → ACTIVE (status={}, lat={}, lng={})", vid, tripStatus, lat, lng);
                } else {
                    log.info("[DASHBOARD_MAP] Vehicle {} → INACTIVE/OFFLINE at last known position (status={}, lat={}, lng={}, lastUpdate={})", 
                        vid, tripStatus, lat, lng, lastUpdateTime);
                }
                popup.setStatus(tripStatus);
                popup.setDriverName(row.get("driver_name") != null ? row.get("driver_name").toString() : "");
                popup.setSpeed(String.valueOf((int) spd));
                popup.setLat(lat);
                popup.setLng(lng);
                popup.setOverspeed(row.get("overspeed")          != null ? row.get("overspeed").toString()          : "No");
                popup.setSmoking(row.get("smoking_status")       != null ? row.get("smoking_status").toString()     : "No");
                popup.setMobileUsage(row.get("mobile_usage")     != null ? row.get("mobile_usage").toString()       : "No");
                popup.setDrowsiness(row.get("drowsiness_status") != null ? row.get("drowsiness_status").toString()  : "Normal");
                popup.setHarshBraking(row.get("harsh_braking")   != null ? row.get("harsh_braking").toString()      : "No");
                popup.setHarshAcceleration(row.get("harsh_acceleration") != null ? row.get("harsh_acceleration").toString() : "No");
                popup.setRashTurning(row.get("rash_turning")     != null ? row.get("rash_turning").toString()        : "No");
                
                // IMPORTANT: Only mark route deviation for ACTIVE vehicles
                // Inactive vehicles with stale telemetry should not show deviation
                popup.setRouteDeviation((isActive && deviatedVehicles.contains(vid)) ? "Yes" : "No");
                
                // IMPORTANT: Clear alert flags for inactive vehicles (no live alerts from offline vehicles)
                if (!isActive) {
                    popup.setOverspeed("No");
                    popup.setSmoking("No");
                    popup.setMobileUsage("No");
                    popup.setDrowsiness("Normal");
                    popup.setHarshBraking("No");
                    popup.setHarshAcceleration("No");
                    popup.setRashTurning("No");
                }
                
                popup.setAddress(row.get("address")        != null ? row.get("address").toString()        : "");
                popup.setCoordinates(row.get("coordinates") != null ? row.get("coordinates").toString()  : "");
                popup.setLastUpdateTime(lastUpdateTime);
                popup.setLastUpdateDate(lastUpdateDate);
                
                Map<String, Object> entry = buildVehicleEntry(vid, lat, lng, spd, popup.getDriverName(), popup, isActive);
                result.add(entry);
            }
        } catch (Exception e) {
            log.error("[DASHBOARD] Error in getLiveVehicles: {}", e.getMessage(), e);
        }
        
        log.info("[DASHBOARD] Returning {} vehicles to frontend", result.size());
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> buildVehicleEntry(String vehicleId, double lat, double lng,
                                                   double speed, String driverName, VehiclePopupData popup, boolean isActive) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("vehicleId",   vehicleId);
        m.put("lat",         lat);
        m.put("lng",         lng);
        m.put("speed",       speed);
        m.put("driverName",  driverName);
        m.put("isActive",    isActive); // Flag to distinguish live vs stale telemetry
        if (popup != null) {
            m.put("tripStatus",      popup.getStatus());
            m.put("overspeed",       popup.getOverspeed());
            m.put("smoking",         popup.getSmoking());
            m.put("mobileUsage",     popup.getMobileUsage());
            m.put("drowsiness",      popup.getDrowsiness());
            m.put("harshBraking",    popup.getHarshBraking());
            m.put("harshAcceleration", popup.getHarshAcceleration());
            m.put("rashTurning",     popup.getRashTurning());
            m.put("routeDeviation",  popup.getRouteDeviation());
            m.put("address",         popup.getAddress());
            m.put("coordinates",     popup.getCoordinates());
            m.put("lastUpdateTime",  popup.getLastUpdateTime());
            m.put("lastUpdateDate",  popup.getLastUpdateDate());
        }
        return m;
    }
}
