package com.vts.controller;

import com.vts.entity.Client;
import com.vts.entity.Vehicle;
import com.vts.repository.AdminAssociationRepository;
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

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/fleet")
public class FleetController {

    private static final Logger log = LoggerFactory.getLogger(FleetController.class);
    
    private final VehicleService                vehicleService;
    private final AssociationRepository         associationRepository;
    private final AdminAssociationRepository    adminAssociationRepository;
    private final DriverRepository              driverRepository;
    private final ThingsBoardDirectQueryService tbQuery;
    private final ThingsBoardAuthService        tbAuth;
    private final AuthService                   authService;
    private final VehicleRepository             vehicleRepository;
    private final RestTemplate                  restTemplate = new RestTemplate();

    public FleetController(VehicleService vehicleService,
                           AssociationRepository associationRepository,
                           AdminAssociationRepository adminAssociationRepository,
                           DriverRepository driverRepository,
                           ThingsBoardDirectQueryService tbQuery,
                           ThingsBoardAuthService tbAuth,
                           AuthService authService,
                           VehicleRepository vehicleRepository) {
        this.vehicleService        = vehicleService;
        this.associationRepository = associationRepository;
        this.adminAssociationRepository = adminAssociationRepository;
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
        Client  client       = authService.getCurrentClient();
        boolean isSuperAdmin = authService.isSuperAdmin(client);
        boolean isOrgAdmin   = authService.isAdmin(client);
        Long    cid          = client != null ? client.getId() : null;
        Long    orgId        = client != null ? client.getOrgId() : null;

        List<Vehicle> vehicles = vehicleService.getVehiclesForCurrentRole();

        // Build vehicleId -> driverName map from associations
        List<Map<String, Object>> assocRows;
        if (isSuperAdmin) {
            assocRows = associationRepository.findVehiclesWithDriverAllClients(null);
        } else if (isOrgAdmin) {
            assocRows = associationRepository.findVehiclesWithDriverByOrgId(orgId, null);
        } else {
            assocRows = cid != null ? associationRepository.findVehiclesWithDriverByClientId(cid, null) : List.of();
        }

        Map<String, String> vehicleDriverMap = new LinkedHashMap<>();
        for (Map<String, Object> row : assocRows) {
            Object regNo      = row.get("registration_no");
            Object driverName = row.get("driver_name");
            if (regNo != null) vehicleDriverMap.put(regNo.toString(), driverName != null ? driverName.toString() : "—");
        }

        // Fetch live telemetry for trip_status (only returns ACTIVE/ONLINE vehicles)
        Map<String, String> liveStatus = new HashMap<>();
        Set<String> liveVehicleIds = new HashSet<>();
        try {
            List<Map<String, Object>> telemetry;
            if (isSuperAdmin) {
                telemetry = tbQuery.fetchAllLiveTelemetry(null, null);
            } else if (isOrgAdmin) {
                telemetry = tbQuery.fetchAllLiveTelemetry(null, orgId);
            } else {
                telemetry = tbQuery.fetchAllLiveTelemetry(cid, null);
            }
            for (Map<String, Object> row : telemetry) {
                String vid    = (String) row.get("vehicle_id");
                String status = row.get("trip_status") != null ? row.get("trip_status").toString() : "Parked";
                if (vid != null) {
                    liveStatus.put(vid, status);
                    liveVehicleIds.add(vid);
                }
            }
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Vehicle v : vehicles) {
            String licensePlate = v.getLicensePlate();
            // CRITICAL FIX: If vehicle is not in live telemetry list, it's OFFLINE (not Parked)
            String tripStatus;
            if (liveVehicleIds.contains(licensePlate)) {
                tripStatus = liveStatus.getOrDefault(licensePlate, "Parked");
            } else {
                // Vehicle not in live telemetry = INACTIVE in ThingsBoard or telemetry > 120s old
                tripStatus = "Offline";
            }
            
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id",             v.getId());
            entry.put("licensePlate",   licensePlate);
            entry.put("vehicleMake",    v.getVehicleMake());
            entry.put("vehicleModel",   v.getVehicleModel());
            entry.put("driverName",     vehicleDriverMap.getOrDefault(licensePlate, "—"));
            entry.put("tripStatus",     tripStatus);
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

        // Check if vehicle-device association exists
        // Note: admin_associations.vehicle_id is INTEGER while vehicles.id is BIGINT
        // Safe to cast since vehicle IDs in practice won't exceed Integer.MAX_VALUE
        Integer vehicleIdInt = id.intValue();
        boolean hasVehicleDeviceLink = adminAssociationRepository.existsByVehicleId(vehicleIdInt);
        result.put("hasVehicleDeviceLink", hasVehicleDeviceLink);
        
        log.info("[FLEET] Vehicle {} (ID={}) hasVehicleDeviceLink={}", regNo, id, hasVehicleDeviceLink);

        // Live telemetry from ThingsBoard
        try {
            Map<String, Object> telemetry = tbQuery.fetchSingleVehicleTelemetry(regNo);
            if (telemetry != null) {
                // Check ThingsBoard device state
                String tbState = (String) telemetry.get("thingsBoardState");
                boolean isDeviceActive = "ACTIVE".equals(tbState);
                
                log.info("[FLEET] Vehicle {} ThingsBoard state: {}, isActive: {}", regNo, tbState, isDeviceActive);
                
                // TASK 1: Only provide live values when device is ACTIVE and sending live telemetry
                if (isDeviceActive && hasVehicleDeviceLink) {
                    result.put("speed",          telemetry.getOrDefault("speed", 0));
                    result.put("engineRpm",      telemetry.getOrDefault("engineRpm", 0));
                    result.put("ignitionStatus", telemetry.getOrDefault("ignition_status", "OFF"));
                    result.put("tripStatus",     telemetry.getOrDefault("trip_status", "Parked"));
                    result.put("batteryPercentage", telemetry.getOrDefault("battery_percentage", null));
                    result.put("batteryStatus",     telemetry.getOrDefault("battery_status", null));
                    
                    // TASK 2: Return signal_strength as numeric value (1-5) for bar graph display
                    Integer signalStrength = (Integer) telemetry.get("signal_strength");
                    if (signalStrength != null && signalStrength >= 1 && signalStrength <= 5) {
                        result.put("signalStrength", signalStrength);
                        result.put("signalHealth", signalStrength); // Keep for backward compatibility
                    } else {
                        result.put("signalStrength", null);
                        result.put("signalHealth", "—");
                    }
                    
                    // TASK 3: Use event_time directly as Last Updated
                    // event_time format from ThingsBoard: "DD-MM-YYYYHH:mm:ss"
                    String eventTime = (String) telemetry.get("event_time");
                    if (eventTime != null && !eventTime.isEmpty()) {
                        try {
                            // Parse event_time: "30-09-202616:42:10" → "30-09-2026 16:42:10"
                            String normalized = eventTime;
                            if (eventTime.length() >= 16) {
                                normalized = eventTime.substring(0, 10) + " " + eventTime.substring(10);
                            }
                            
                            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
                            java.time.LocalDateTime localDateTime = java.time.LocalDateTime.parse(normalized, formatter);
                            ZoneId zone = ZoneId.of("Asia/Kolkata");
                            java.time.ZonedDateTime zonedDateTime = localDateTime.atZone(zone);
                            
                            result.put("lastUpdateTime", DateTimeFormatter.ofPattern("hh:mm a").format(zonedDateTime));
                            result.put("lastUpdateDate", DateTimeFormatter.ofPattern("dd/MM/yyyy").format(zonedDateTime));
                            
                            log.info("[FLEET] Using event_time for vehicle {}: {} → {} {}", 
                                regNo, eventTime, result.get("lastUpdateTime"), result.get("lastUpdateDate"));
                        } catch (Exception e) {
                            log.error("[FLEET] Error parsing event_time '{}' for vehicle {}: {}", eventTime, regNo, e.getMessage());
                            // Fallback to lastUpdateTime/Date from telemetry
                            result.put("lastUpdateTime", telemetry.getOrDefault("lastUpdateTime", "—"));
                            result.put("lastUpdateDate", telemetry.getOrDefault("lastUpdateDate", "—"));
                        }
                    } else {
                        result.put("lastUpdateTime", telemetry.getOrDefault("lastUpdateTime", "—"));
                        result.put("lastUpdateDate", telemetry.getOrDefault("lastUpdateDate", "—"));
                    }
                    
                    log.info("[FLEET] Vehicle {} telemetry ACTIVE: speed={}, engineRpm={}, signal={}, lastUpdate={}", 
                        regNo, 
                        telemetry.get("speed"), 
                        telemetry.get("engineRpm"),
                        result.get("signalStrength"),
                        result.get("lastUpdateTime"));
                } else {
                    // Device INACTIVE or no link - don't show live values, keep UI placeholders
                    log.warn("[FLEET] Device INACTIVE or no link for vehicle {} - returning placeholders", regNo);
                    result.put("speed",          0);
                    result.put("engineRpm",      0);
                    result.put("ignitionStatus", "OFF");
                    result.put("tripStatus",     "Offline");
                    result.put("lastUpdateTime", "—");
                    result.put("lastUpdateDate", "—");
                    result.put("batteryPercentage", null);
                    result.put("batteryStatus",     null);
                    result.put("signalStrength",    null);
                    result.put("signalHealth",      "Offline");
                }
            } else {
                log.warn("[FLEET] No telemetry found for vehicle {}", regNo);
                result.put("speed",          0);
                result.put("engineRpm",      0);
                result.put("ignitionStatus", "OFF");
                result.put("tripStatus",     "Offline");
                result.put("lastUpdateTime", "—");
                result.put("lastUpdateDate", "—");
                result.put("batteryPercentage", null);
                result.put("batteryStatus",     null);
                result.put("signalHealth",   "Offline");
            }
        } catch (Exception e) {
            log.error("[FLEET] Error fetching telemetry for vehicle {}: {}", regNo, e.getMessage(), e);
            result.put("speed",          0);
            result.put("engineRpm",      0);
            result.put("ignitionStatus", "OFF");
            result.put("tripStatus",     "Offline");
            result.put("lastUpdateTime", "—");
            result.put("lastUpdateDate", "—");
            result.put("batteryPercentage", null);
            result.put("batteryStatus",     null);
            result.put("signalHealth",   "Offline");
        }

        return ResponseEntity.ok(result);
    }

}
