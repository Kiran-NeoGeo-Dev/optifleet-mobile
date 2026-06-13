package com.vts.service;

import com.vts.entity.Association;
import com.vts.entity.Client;
import com.vts.entity.DeviceDriver;
import com.vts.entity.Driver;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DeviceDriverRepository;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.DriverRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AssociationService {

    private final AssociationRepository  associationRepository;
    private final DeviceDriverRepository deviceDriverRepository;
    private final DriverRepository       driverRepository;
    private final AuthService            authService;

    private final AdminAssociationRepository adminAssociationRepository;

    public AssociationService(AssociationRepository associationRepository,
                              DeviceDriverRepository deviceDriverRepository,
                              AdminAssociationRepository adminAssociationRepository,
                              DriverRepository driverRepository,
                              AuthService authService) {
        this.associationRepository  = associationRepository;
        this.deviceDriverRepository = deviceDriverRepository;
        this.adminAssociationRepository = adminAssociationRepository;
        this.driverRepository       = driverRepository;
        this.authService            = authService;
    }

    // ── Dropdowns ──────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getVehiclesWithDevice() {
        Client client = authService.getCurrentClient();
        Long clientId = (client != null) ? client.getId() : null;
        return adminAssociationRepository.findVehiclesWithAdminDevice(clientId);
    }

    public List<Map<String, Object>> getVehiclesWithDriverForTrip() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if ("Admin".equalsIgnoreCase(client.getRole())) {
            return associationRepository.findVehiclesWithDriverAllClients();
        }
        return associationRepository.findVehiclesWithDriverByClientId(client.getId());
    }

    public List<Map<String, Object>> getDriversByDevice(Integer deviceId) {
        if (deviceId == null) return List.of();
        return deviceDriverRepository.findDriversByDeviceId(deviceId);
    }

    public List<DeviceDriver> getAllDeviceDrivers() {
        return deviceDriverRepository.findAll();
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    public Association createAssociation(Integer vehicleId, Integer deviceId, Integer driverId,
                                         String country, Boolean status) {
        if (vehicleId == null || deviceId == null || driverId == null)
            throw new IllegalArgumentException("vehicleId, deviceId and driverId are required");

        validateDriverForCurrentClient(driverId);

        // Check if association already exists for this vehicle-device pair
        Optional<Association> existingAssoc = associationRepository.findByVehicleIdAndDeviceId(vehicleId, deviceId);
        
        if (existingAssoc.isPresent()) {
            // Update existing association with new driver
            Association assoc = existingAssoc.get();
            assoc.setDriverId(driverId);
            assoc.setCountry(country != null ? country : "India");
            assoc.setStatus(status != null ? status : true);
            return associationRepository.save(assoc);
        } else {
            // Create new association
            Client client = authService.getCurrentClient();
            Association assoc = new Association();
            assoc.setVehicleId(vehicleId);
            assoc.setDeviceId(deviceId);
            assoc.setDriverId(driverId);
            assoc.setCountry(country != null ? country : "India");
            assoc.setStatus(status != null ? status : true);
            assoc.setCreatedAt(LocalDateTime.now());
            if (client != null) assoc.setClientId(client.getId());
            return associationRepository.save(assoc);
        }
    }

    // Legacy path (used by old mobile client)
    public Association createAssociation(Integer vehicleId, Integer deviceDriverId) {
        DeviceDriver dd = deviceDriverRepository.findById(deviceDriverId)
                .orElseThrow(() -> new RuntimeException("Device-Driver mapping not found"));
        return createAssociation(vehicleId, dd.getDeviceId(), dd.getDriverId(), "India", true);
    }

    public List<Map<String, Object>> getAllAssociationsWithDetails() {
        Client client = authService.getCurrentClient();
        if (client != null && !"Admin".equalsIgnoreCase(client.getRole())) {
            // Full associations (own + admin-created for this client's vehicles)
            List<Map<String, Object>> full = new java.util.ArrayList<>(
                associationRepository.findAllWithDetailsByClientId(client.getId()));
            // Pending: admin linked vehicle+device but no full association yet
            List<Map<String, Object>> pending = adminAssociationRepository
                .findVehiclesWithAdminDevice(client.getId())
                .stream()
                .map(v -> {
                    java.util.Map<String, Object> row = new java.util.LinkedHashMap<>(v);
                    row.put("id", "pending_" + v.get("vehicle_id"));
                    row.put("driver_id", null);
                    row.put("driver_name", "Driver Association Pending");
                    row.put("license_no", "");
                    row.put("country", "");
                    row.put("status", false);
                    row.put("association_status", "PENDING");
                    return row;
                })
                .collect(java.util.stream.Collectors.toList());
            full.addAll(pending);
            return full;
        }
        return associationRepository.findAllWithDetails();
    }

    public List<Association> getAssociationsForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        return associationRepository.findByClientId(client.getId());
    }

    public List<Association> getAllAssociations() {
        return associationRepository.findAll();
    }

    public Optional<Association> getById(Integer id) {
        return associationRepository.findById(id);
    }

    private void validateDriverForCurrentClient(Integer driverId) {
        Client currentClient = authService.getCurrentClient();
        if (currentClient == null || "Admin" .equalsIgnoreCase(currentClient.getRole())) {
            return;
        }

        Driver driver = driverRepository.findById(driverId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
        if (!currentClient.getId().equals(driver.getClientId())) {
            throw new IllegalArgumentException("Selected driver does not belong to the current client");
        }
    }

    public Association updateAssociation(Integer id, Integer vehicleId, Integer deviceId,
                                          Integer driverId, String country, Boolean status) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));

        validateDriverForCurrentClient(driverId);

        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        return associationRepository.save(assoc);
    }

    public void deleteAssociation(Integer id) {
        if (!associationRepository.existsById(id))
            throw new RuntimeException("Association not found");
        associationRepository.deleteById(id);
    }

    public long countAssociationsForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return 0;
        return associationRepository.countByClientId(client.getId());
    }
}
