package com.vts.service;

import com.vts.dto.DashboardResponse;
import com.vts.entity.Client;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.TripRepository;
import com.vts.repository.UserDetailRepository;
import com.vts.repository.VehicleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class DashboardService {

    private final DriverRepository           driverRepository;
    private final VehicleRepository          vehicleRepository;
    private final AssociationRepository      associationRepository;
    private final AdminAssociationRepository adminAssociationRepository;
    private final DeviceRepository           deviceRepository;
    private final TripRepository             tripRepository;
    private final UserDetailRepository       userDetailRepository;
    private final AuthService                authService;
    private final JdbcTemplate               jdbc;
    private final ThingsBoardDirectQueryService thingsBoardDirectQueryService;

    public DashboardService(DriverRepository driverRepository,
                            VehicleRepository vehicleRepository,
                            AssociationRepository associationRepository,
                            AdminAssociationRepository adminAssociationRepository,
                            DeviceRepository deviceRepository,
                            TripRepository tripRepository,
                            UserDetailRepository userDetailRepository,
                            AuthService authService,
                            JdbcTemplate jdbc,
                            ThingsBoardDirectQueryService thingsBoardDirectQueryService) {
        this.driverRepository           = driverRepository;
        this.vehicleRepository          = vehicleRepository;
        this.associationRepository      = associationRepository;
        this.adminAssociationRepository = adminAssociationRepository;
        this.deviceRepository           = deviceRepository;
        this.tripRepository             = tripRepository;
        this.userDetailRepository       = userDetailRepository;
        this.authService                = authService;
        this.jdbc                       = jdbc;
        this.thingsBoardDirectQueryService = thingsBoardDirectQueryService;
    }

    public DashboardResponse getDashboardForCurrentClient() {
        Client  client  = authService.getCurrentClient();
        boolean isAdmin = client != null && "Admin".equalsIgnoreCase(client.getRole());
        Long    cid     = client != null ? client.getId() : null;

        long totalDrivers = isAdmin ? driverRepository.count()
                          : (cid != null ? driverRepository.countByClientId(cid) : 0);
        long totalVehicles = isAdmin ? vehicleRepository.count()
                           : (cid != null ? vehicleRepository.countByClientId(cid) : 0);
        long totalAssociations = isAdmin ? countUniqueAssociationsForAdmin()
                               : (cid != null ? countUniqueAssociationsForClient(cid) : 0);
        long totalDevices = deviceRepository.count();
        long totalTrips   = isAdmin ? tripRepository.count()
                          : (cid != null ? tripRepository.countByVehicleClientId(cid) : 0);
        long totalUsers   = isAdmin ? userDetailRepository.count() : 0;

        // ── Live counts from ThingsBoard (direct query) ─────────────────────
        long activeVehicles = 0, idleVehicles = 0, activeDrivers = 0, activeAlerts = 0;
        try {
            // Query ThingsBoard directly for live telemetry
            List<Map<String, Object>> telemetryData = thingsBoardDirectQueryService.fetchAllLiveTelemetry(isAdmin ? null : cid);

            // Count vehicles by trip status
            Set<String> movingVehicles = new HashSet<>();
            Set<String> idleVehiclesSet = new HashSet<>();
            Set<String> activeDriversSet = new HashSet<>();
            int alertCount = 0;

            for (Map<String, Object> row : telemetryData) {
                String vehicleId = (String) row.get("vehicle_id");
                String tripStatus = row.get("trip_status") != null ? row.get("trip_status").toString() : "";
                String driverName = row.get("driver_name") != null ? row.get("driver_name").toString() : "";

                // Count vehicles by trip status
                if ("moving".equalsIgnoreCase(tripStatus)) {
                    movingVehicles.add(vehicleId);
                    if (!driverName.isEmpty()) {
                        activeDriversSet.add(driverName);
                    }
                } else if ("idle".equalsIgnoreCase(tripStatus)) {
                    idleVehiclesSet.add(vehicleId);
                }

                // Count alerts
                String overspeed = row.get("overspeed") != null ? row.get("overspeed").toString() : "";
                String smoking = row.get("smoking_status") != null ? row.get("smoking_status").toString() : "";
                String mobile = row.get("mobile_usage") != null ? row.get("mobile_usage").toString() : "";
                String drowsiness = row.get("drowsiness_status") != null ? row.get("drowsiness_status").toString() : "";

                if ("yes".equalsIgnoreCase(overspeed) ||
                    "yes".equalsIgnoreCase(smoking) ||
                    "yes".equalsIgnoreCase(mobile) ||
                    "fatigue".equalsIgnoreCase(drowsiness) ||
                    "yes".equalsIgnoreCase(drowsiness)) {
                    alertCount++;
                }
            }

            activeVehicles = movingVehicles.size();
            idleVehicles = idleVehiclesSet.size();
            activeDrivers = activeDriversSet.size();
            activeAlerts = alertCount;
        } catch (Exception ignored) {}

        return new DashboardResponse(totalDrivers, activeDrivers, totalVehicles,
            activeVehicles, idleVehicles, activeAlerts,
            totalAssociations, totalDevices, totalTrips, totalUsers);
    }

    private long countUniqueAssociationsForAdmin() {
        Set<String> uniquePairs = new HashSet<>();
        associationRepository.findAll().forEach(a -> {
            if (a.getVehicleId() != null && a.getDeviceId() != null)
                uniquePairs.add(a.getVehicleId() + "-" + a.getDeviceId());
        });
        return uniquePairs.size();
    }

    private long countUniqueAssociationsForClient(Long clientId) {
        Set<String> uniquePairs = new HashSet<>();
        associationRepository.findByClientId(clientId).forEach(a -> {
            if (a.getVehicleId() != null && a.getDeviceId() != null)
                uniquePairs.add(a.getVehicleId() + "-" + a.getDeviceId());
        });
        List<Map<String, Object>> adminPairs = adminAssociationRepository.findVehiclesWithAdminDevice(clientId);
        for (Map<String, Object> pair : adminPairs) {
            Object vehicleId = pair.get("vehicle_id");
            Object deviceId  = pair.get("device_id");
            if (vehicleId != null && deviceId != null)
                uniquePairs.add(vehicleId.toString() + "-" + deviceId.toString());
        }
        return uniquePairs.size();
    }
}
