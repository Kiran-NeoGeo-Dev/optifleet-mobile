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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpMethod;

import java.util.*;

@RestController
@RequestMapping("/api/fleet")
public class FleetController {

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
                result.put("speed",         telemetry.getOrDefault("speed", 0));
                result.put("engineRpm",     telemetry.getOrDefault("engineRpm", 0));
                result.put("ignitionStatus",telemetry.getOrDefault("ignition_status", "OFF"));
                result.put("tripStatus",    telemetry.getOrDefault("trip_status", "Parked"));
            } else {
                result.put("speed",         0);
                result.put("engineRpm",     0);
                result.put("ignitionStatus","OFF");
                result.put("tripStatus",    "Parked");
            }
        } catch (Exception e) {
            result.put("speed",         0);
            result.put("engineRpm",     0);
            result.put("ignitionStatus","OFF");
            result.put("tripStatus",    "Parked");
        }

        // Signal health from last 50 trip_status values via ThingsBoard history
        String signalHealth = calcSignalHealth(regNo);
        result.put("signalHealth", signalHealth);

        return ResponseEntity.ok(result);
    }

    /**
     * Fetch last 50 trip_status values for vehicleId from ThingsBoard and compute health score.
     */
    @SuppressWarnings("unchecked")
    private String calcSignalHealth(String vehicleId) {
        try {
            // Resolve TB device entity ID via existing service
            String url = tbAuth.activeUrl() + "/api/tenant/devices?deviceName=" + vehicleId;
            var res = restTemplate.exchange(url, HttpMethod.GET, tbAuth.authEntity(), Map.class);
            if (res.getBody() == null) return "Fair";
            Object idObj = res.getBody().get("id");
            if (!(idObj instanceof Map)) return "Fair";
            String entityId = (String) ((Map<?, ?>) idObj).get("id");
            if (entityId == null) return "Fair";

            // Fetch last 50 trip_status time-series values
            long endTs   = System.currentTimeMillis();
            long startTs = endTs - 7L * 24 * 60 * 60 * 1000; // last 7 days
            String histUrl = tbAuth.activeUrl()
                + "/api/plugins/telemetry/DEVICE/" + entityId
                + "/values/timeseries?keys=trip_status&startTs=" + startTs
                + "&endTs=" + endTs + "&limit=50&orderBy=DESC";

            var histRes = restTemplate.exchange(histUrl, HttpMethod.GET, tbAuth.authEntity(), Map.class);
            if (histRes.getBody() == null) return "Fair";

            Object raw = histRes.getBody().get("trip_status");
            if (!(raw instanceof List)) return "Fair";

            int moving = 0, idle = 0, parked = 0;
            for (Object entry : (List<?>) raw) {
                if (!(entry instanceof Map)) continue;
                Object val = ((Map<?, ?>) entry).get("value");
                if (val == null) continue;
                String s = val.toString().trim().toLowerCase();
                if ("moving".equals(s))      moving++;
                else if ("idle".equals(s))   idle++;
                else if ("parked".equals(s)) parked++;
            }

            int score = (moving * 5) + (idle * 3) + (parked * 1);
            if (score >= 40)  return "Excellent";
            if (score >= 25)  return "Good";
            if (score >= 15)  return "Fair";
            return "Poor";
        } catch (Exception e) {
            return "Fair";
        }
    }
}
