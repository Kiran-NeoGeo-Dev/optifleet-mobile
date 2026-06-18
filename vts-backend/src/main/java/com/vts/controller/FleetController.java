package com.vts.controller;

import com.vts.entity.Client;
import com.vts.entity.Vehicle;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.VehicleRepository;
import com.vts.service.AuthService;
import com.vts.service.ThingsBoardAuthService;
import com.vts.service.ThingsBoardDirectQueryService;
import com.vts.service.VehicleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpMethod;

import java.util.*;

@RestController
@RequestMapping("/api/fleet")
public class FleetController {

    private static final Logger log = LoggerFactory.getLogger(FleetController.class);
    
    private final VehicleService                vehicleService;
    private final AssociationRepository         associationRepository;
    private final DriverRepository              driverRepository;
    private final ThingsBoardDirectQueryService tbQuery;
    private final ThingsBoardAuthService        tbAuth;
    private final AuthService                   authService;
    private final VehicleRepository             vehicleRepository;
    private final RestTemplate                  restTemplate = new RestTemplate();

    public FleetController(VehicleService vehicleService,
                           AssociationRepository associationRepository,
                           DriverRepository driverRepository,
                           ThingsBoardDirectQueryService tbQuery,
                           ThingsBoardAuthService tbAuth,
                           AuthService authService,
                           VehicleRepository vehicleRepository) {
        this.vehicleService        = vehicleService;
        this.associationRepository = associationRepository;
        this.driverRepository      = driverRepository;
        this.tbQuery               = tbQuery;
        this.tbAuth                = tbAuth;
        this.authService           = authService;
        this.vehicleRepository     = vehicleRepository;
    }

    /**
     * GET /api/fleet/vehicles
     * Returns all vehicles (role-aware) enriched with driver name + live trip_status.
     */
    @GetMapping("/vehicles")
    public ResponseEntity<List<Map<String, Object>>> getFleetVehicles() {
        Client  client  = authService.getCurrentClient();
        boolean isAdmin = client != null && "Admin".equalsIgnoreCase(client.getRole());
        Long    cid     = client != null ? client.getId() : null;

        List<Vehicle> vehicles = vehicleService.getVehiclesForCurrentRole();

        // Build vehicleId → driverName map from associations
        List<Map<String, Object>> assocRows = isAdmin
                ? associationRepository.findVehiclesWithDriverAllClients()
                : (cid != null ? associationRepository.findVehiclesWithDriverByClientId(cid) : List.of());

        Map<String, String> vehicleDriverMap = new LinkedHashMap<>();
        for (Map<String, Object> row : assocRows) {
            Object regNo      = row.get("registration_no");
            Object driverName = row.get("driver_name");
            if (regNo != null) vehicleDriverMap.put(regNo.toString(), driverName != null ? driverName.toString() : "—");
        }

        // Fetch live telemetry for trip_status
        Map<String, String> liveStatus = new HashMap<>();
        try {
            List<Map<String, Object>> telemetry = tbQuery.fetchAllLiveTelemetry(isAdmin ? null : cid);
            for (Map<String, Object> row : telemetry) {
                String vid    = (String) row.get("vehicle_id");
                String status = row.get("trip_status") != null ? row.get("trip_status").toString() : "Parked";
                if (vid != null) liveStatus.put(vid, status);
            }
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Vehicle v : vehicles) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id",             v.getId());
            entry.put("licensePlate",   v.getLicensePlate());
            entry.put("vehicleMake",    v.getVehicleMake());
            entry.put("vehicleModel",   v.getVehicleModel());
            entry.put("driverName",     vehicleDriverMap.getOrDefault(v.getLicensePlate(), "—"));
            entry.put("tripStatus",     liveStatus.getOrDefault(v.getLicensePlate(), "Parked"));
            entry.put("vehiclePhoto",   v.getVehiclePhoto());
            entry.put("clientId",       v.getClientId());
            result.add(entry);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/fleet/vehicles/{id}/telemetry
     * Returns live telemetry + signal health for a specific vehicle.
     */
    @SuppressWarnings("unchecked")
    @GetMapping("/vehicles/{id}/telemetry")
    public ResponseEntity<Map<String, Object>> getVehicleTelemetry(@PathVariable Long id) {
        Vehicle vehicle = vehicleService.getVehicle(id);
        String  regNo   = vehicle.getLicensePlate();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("vehicleId",   id);
        result.put("licensePlate", regNo);
        result.put("vehicleModel", (vehicle.getVehicleMake() != null ? vehicle.getVehicleMake() : "")
                + " " + (vehicle.getVehicleModel() != null ? vehicle.getVehicleModel() : ""));

        // Live telemetry from ThingsBoard
        try {
            Map<String, Object> telemetry = tbQuery.fetchSingleVehicleTelemetry(regNo);
            if (telemetry != null) {
                result.put("speed",          telemetry.getOrDefault("speed", 0));
                result.put("engineRpm",      telemetry.getOrDefault("engineRpm", 0));  // Now using correct key
                result.put("ignitionStatus", telemetry.getOrDefault("ignition_status", "OFF"));
                result.put("tripStatus",     telemetry.getOrDefault("trip_status", "Parked"));
                result.put("lastUpdateTime", telemetry.getOrDefault("lastUpdateTime", ""));
                result.put("lastUpdateDate", telemetry.getOrDefault("lastUpdateDate", ""));
                
                // Log telemetry for debugging
                log.info("[FLEET] Vehicle {} telemetry: speed={}, engineRpm={}, status={}", 
                    regNo, 
                    telemetry.get("speed"), 
                    telemetry.get("engineRpm"), 
                    telemetry.get("trip_status"));
            } else {
                log.warn("[FLEET] No telemetry found for vehicle {}", regNo);
                result.put("speed",          0);
                result.put("engineRpm",      0);
                result.put("ignitionStatus", "OFF");
                result.put("tripStatus",     "Parked");
                result.put("lastUpdateTime", "");
                result.put("lastUpdateDate", "");
            }
        } catch (Exception e) {
            log.error("[FLEET] Error fetching telemetry for vehicle {}: {}", regNo, e.getMessage());
            result.put("speed",          0);
            result.put("engineRpm",      0);
            result.put("ignitionStatus", "OFF");
            result.put("tripStatus",     "Parked");
            result.put("lastUpdateTime", "");
            result.put("lastUpdateDate", "");
        }

        // Signal health from last 50 trip_status values via ThingsBoard history
        String signalHealth = calcSignalHealth(regNo);
        result.put("signalHealth", signalHealth);

        return ResponseEntity.ok(result);
    }

    /**
     * Calculate signal health based on:
     * Priority 1: device_status (Inactive → Offline)
     * Priority 2: last_telemetry_timestamp (> 120s → Offline)
     * Priority 3: HDOP (GPS accuracy)
     * 
     * Returns: Offline / Ideal / Excellent / Good / Moderate / Poor / VeryPoor
     */
    @SuppressWarnings("unchecked")
    private String calcSignalHealth(String vehicleId) {
        try {
            // Fetch LIVE telemetry for this vehicle
            Map<String, Object> telemetry = tbQuery.fetchSingleVehicleTelemetry(vehicleId);
            if (telemetry == null) {
                log.warn("[SIGNAL_HEALTH] No telemetry for vehicle {}", vehicleId);
                return "Offline";
            }
            
            // PRIORITY 1: Check device_status attribute
            String deviceStatus = (String) telemetry.get("device_status");
            log.debug("[SIGNAL_HEALTH] Vehicle {} device_status: {}", vehicleId, deviceStatus);
            if ("Inactive".equalsIgnoreCase(deviceStatus)) {
                log.info("[SIGNAL_HEALTH] Vehicle {} OFFLINE - device_status=Inactive", vehicleId);
                return "Offline";
            }
            
            // PRIORITY 2: Check timestamp (> 120s = OFFLINE)
            Long timestamp = (Long) telemetry.get("telemetryTimestamp");
            if (timestamp == null) {
                log.warn("[SIGNAL_HEALTH] Vehicle {} has no telemetry timestamp - marking OFFLINE", vehicleId);
                return "Offline";
            }
            
            long ageMs = System.currentTimeMillis() - timestamp;
            long ageSeconds = ageMs / 1000;
            if (ageMs > 120_000L) {
                log.info("[SIGNAL_HEALTH] Vehicle {} OFFLINE - telemetry age={}s > 120s", vehicleId, ageSeconds);
                return "Offline";
            }
            
            // PRIORITY 3: Check HDOP (GPS accuracy)
            Double hdop = (Double) telemetry.get("hdop");
            if (hdop == null) {
                hdop = (Double) telemetry.get("gps_accuracy");
            }
            
            if (hdop == null) {
                log.debug("[SIGNAL_HEALTH] Vehicle {} has no HDOP/gps_accuracy - defaulting to Moderate", vehicleId);
                hdop = 5.0;  // Default: Moderate
            }
            
            log.debug("[SIGNAL_HEALTH] Vehicle {} HDOP={}", vehicleId, hdop);
            
            // HDOP Ranges (lower = better accuracy)
            // 0.5 – 1.0     → Ideal 🟢
            // 1.0 – 2.0     → Excellent 🟢
            // 2.0 – 5.0     → Good 🔵
            // 5.0 – 10.0    → Moderate 🟡
            // 10.0 – 20.0   → Poor 🟠
            // > 20.0        → Very Poor 🔴
            if (hdop >= 0.5 && hdop < 1.0)   return "Ideal";
            if (hdop >= 1.0 && hdop < 2.0)   return "Excellent";
            if (hdop >= 2.0 && hdop < 5.0)   return "Good";
            if (hdop >= 5.0 && hdop < 10.0)  return "Moderate";
            if (hdop >= 10.0 && hdop < 20.0) return "Poor";
            if (hdop >= 20.0)                return "VeryPoor";
            
            return "Moderate";
            
        } catch (Exception e) {
            log.error("[SIGNAL_HEALTH] Error calculating signal health for vehicle {}: {}", vehicleId, e.getMessage());
            return "Offline";
        }
    }
}
