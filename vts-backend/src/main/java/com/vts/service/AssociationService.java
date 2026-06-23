package com.vts.service;

import com.vts.entity.Association;
import com.vts.entity.Client;
import com.vts.entity.Device;
import com.vts.entity.DeviceDriver;
import com.vts.entity.DeviceTbMapping;
import com.vts.entity.Driver;
import com.vts.entity.Vehicle;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DeviceDriverRepository;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DeviceTbMappingRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.VehicleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for managing Vehicle-Device-Driver associations.
 * Task 2: Automatically renames ThingsBoard devices when associations are created, updated, or deleted.
 */
@Service
public class AssociationService {

    private static final Logger log = LoggerFactory.getLogger(AssociationService.class);

    private final AssociationRepository  associationRepository;
    private final DeviceDriverRepository deviceDriverRepository;
    private final DriverRepository       driverRepository;
    private final AuthService            authService;
    private final AdminAssociationRepository adminAssociationRepository;
    private final VehicleRepository      vehicleRepository;
    private final DeviceRepository       deviceRepository;
    private final DeviceTbMappingRepository deviceTbMappingRepository;
    private final ThingsBoardDeviceService tbDeviceService;

    public AssociationService(AssociationRepository associationRepository,
                              DeviceDriverRepository deviceDriverRepository,
                              AdminAssociationRepository adminAssociationRepository,
                              DriverRepository driverRepository,
                              AuthService authService,
                              VehicleRepository vehicleRepository,
                              DeviceRepository deviceRepository,
                              DeviceTbMappingRepository deviceTbMappingRepository,
                              ThingsBoardDeviceService tbDeviceService) {
        this.associationRepository  = associationRepository;
        this.deviceDriverRepository = deviceDriverRepository;
        this.adminAssociationRepository = adminAssociationRepository;
        this.driverRepository       = driverRepository;
        this.authService            = authService;
        this.vehicleRepository      = vehicleRepository;
        this.deviceRepository       = deviceRepository;
        this.deviceTbMappingRepository = deviceTbMappingRepository;
        this.tbDeviceService        = tbDeviceService;
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
        
        Association assoc;
        if (existingAssoc.isPresent()) {
            // Update existing association with new driver
            assoc = existingAssoc.get();
            assoc.setDriverId(driverId);
            assoc.setCountry(country != null ? country : "India");
            assoc.setStatus(status != null ? status : true);
        } else {
            // Create new association
            Client client = authService.getCurrentClient();
            assoc = new Association();
            assoc.setVehicleId(vehicleId);
            assoc.setDeviceId(deviceId);
            assoc.setDriverId(driverId);
            assoc.setCountry(country != null ? country : "India");
            assoc.setStatus(status != null ? status : true);
            assoc.setCreatedAt(LocalDateTime.now());
            if (client != null) assoc.setClientId(client.getId());
        }
        
        Association saved = associationRepository.save(assoc);
        
        // Task 2: After successful association, rename ThingsBoard device to vehicle license plate
        try {
            renameThingsBoardDevice(vehicleId, deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device after association create: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
        }
        
        return saved;
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

        Integer oldVehicleId = assoc.getVehicleId();
        Integer oldDeviceId = assoc.getDeviceId();
        
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        
        Association updated = associationRepository.save(assoc);
        
        // Task 2: If vehicle or device changed, rename ThingsBoard device to new vehicle license plate
        if (!oldVehicleId.equals(vehicleId) || !oldDeviceId.equals(deviceId)) {
            try {
                renameThingsBoardDevice(vehicleId, deviceId);
            } catch (Exception e) {
                log.error("Failed to rename TB device after association update: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
            }
        }
        
        return updated;
    }

    public void deleteAssociation(Integer id) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));
        
        Integer deviceId = assoc.getDeviceId();
        
        associationRepository.deleteById(id);
        
        // Task 2: After deletion, rename ThingsBoard device back to original Device ID
        try {
            renameThingsBoardDeviceToOriginal(deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device back to original after delete: deviceId={} error={}", deviceId, e.getMessage(), e);
        }
    }

    public long countAssociationsForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return 0;
        return associationRepository.countByClientId(client.getId());
    }

    // ── Task 2: Helper methods for Device Renaming ─────────────────────────────────────

    /**
     * Rename ThingsBoard device to vehicle's license plate (registration number).
     * Called after a Vehicle-Device association is created or updated.
     * @param vehicleId ID of the vehicle
     * @param deviceId ID of the device in the local database
     */
    private void renameThingsBoardDevice(Integer vehicleId, Integer deviceId) {
        // Get vehicle license plate
        Optional<Vehicle> vehicleOpt = vehicleRepository.findById(vehicleId.longValue());
        if (vehicleOpt.isEmpty()) {
            throw new RuntimeException("Vehicle not found: " + vehicleId);
        }
        
        String licensePlate = vehicleOpt.get().getLicensePlate();
        
        // Get device's ThingsBoard device ID
        Optional<Device> deviceOpt = deviceRepository.findById(deviceId.longValue());
        if (deviceOpt.isEmpty()) {
            throw new RuntimeException("Device not found: " + deviceId);
        }
        
        String deviceCode = deviceOpt.get().getDeviceId();
        
        // Find TB device ID from mapping
        String tbDeviceId = findThingsBoardDeviceId(deviceCode);
        if (tbDeviceId == null) {
            log.warn("No ThingsBoard device found for device code: {}", deviceCode);
            return;
        }
        
        // Rename TB device to license plate
        tbDeviceService.updateDevice(tbDeviceId, licensePlate);
        log.info("Task 2: TB device renamed: vehicleId={} deviceId={} licensePlate={}", vehicleId, deviceId, licensePlate);
    }
    
    /**
     * Rename ThingsBoard device back to its original Device ID (on association deletion).
     * Called after a Vehicle-Device association is deleted.
     * @param deviceId ID of the device in the local database
     */
    private void renameThingsBoardDeviceToOriginal(Integer deviceId) {
        // Get device's original Device ID
        Optional<Device> deviceOpt = deviceRepository.findById(deviceId.longValue());
        if (deviceOpt.isEmpty()) {
            throw new RuntimeException("Device not found: " + deviceId);
        }
        
        String originalDeviceCode = deviceOpt.get().getDeviceId();
        
        // Find TB device ID from mapping
        String tbDeviceId = findThingsBoardDeviceId(originalDeviceCode);
        if (tbDeviceId == null) {
            log.warn("No ThingsBoard device found for device code: {}", originalDeviceCode);
            return;
        }
        
        // Rename TB device back to original Device ID
        tbDeviceService.updateDevice(tbDeviceId, originalDeviceCode);
        log.info("Task 2: TB device renamed back to original: deviceId={} originalName={}", deviceId, originalDeviceCode);
    }
    
    /**
     * Find ThingsBoard device ID for a given device code.
     * Queries the device_tb_mapping table.
     * @param deviceCode the device_id from the devices table
     * @return ThingsBoard device ID if found, null otherwise
     */
    private String findThingsBoardDeviceId(String deviceCode) {
        Optional<DeviceTbMapping> mappingOpt = deviceTbMappingRepository.findByDeviceId(deviceCode);
        if (mappingOpt.isEmpty()) {
            return null;
        }
        return mappingOpt.get().getThingsboardDeviceId();
    }
}
