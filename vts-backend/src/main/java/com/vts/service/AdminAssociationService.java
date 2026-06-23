package com.vts.service;

import com.vts.entity.AdminAssociation;
import com.vts.entity.Association;
import com.vts.entity.Device;
import com.vts.entity.DeviceTbMapping;
import com.vts.entity.Vehicle;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.AssociationRepository;
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

@Service
public class AdminAssociationService {

    private static final Logger log = LoggerFactory.getLogger(AdminAssociationService.class);

    private final AdminAssociationRepository adminAssociationRepository;
    private final AssociationRepository associationRepository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceTbMappingRepository deviceTbMappingRepository;
    private final DriverRepository driverRepository;
    private final AuthService authService;
    private final ThingsBoardDeviceService tbDeviceService;

    public AdminAssociationService(AdminAssociationRepository adminAssociationRepository,
                                   AssociationRepository associationRepository,
                                   VehicleRepository vehicleRepository,
                                   DeviceRepository deviceRepository,
                                   DeviceTbMappingRepository deviceTbMappingRepository,
                                   DriverRepository driverRepository,
                                   AuthService authService,
                                   ThingsBoardDeviceService tbDeviceService) {
        this.adminAssociationRepository = adminAssociationRepository;
        this.associationRepository = associationRepository;
        this.vehicleRepository = vehicleRepository;
        this.deviceRepository = deviceRepository;
        this.deviceTbMappingRepository = deviceTbMappingRepository;
        this.driverRepository = driverRepository;
        this.authService = authService;
        this.tbDeviceService = tbDeviceService;
    }

    // ── Dropdowns ──────────────────────────────────────────────────────────────
    public List<Map<String, Object>> getVehiclesDropdown() {
        var client = authService.getCurrentClient();
        if (client != null && !"Admin".equalsIgnoreCase(client.getRole())) {
            return adminAssociationRepository.findVehiclesDropdownByClientId(client.getId());
        }
        return adminAssociationRepository.findVehiclesDropdown();
    }

    public List<Map<String, Object>> getAvailableDevices() {
        var client = authService.getCurrentClient();
        if (client != null && !"Admin".equalsIgnoreCase(client.getRole())) {
            return adminAssociationRepository.findAvailableDevicesByClientUsername(client.getUsername());
        }
        return adminAssociationRepository.findAvailableDevices();
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────
    public AdminAssociation create(Integer vehicleId, Integer deviceId) {
        if (adminAssociationRepository.existsByVehicleId(vehicleId)) {
            throw new IllegalArgumentException("This vehicle is already linked to a device");
        }
        if (adminAssociationRepository.existsByDeviceId(deviceId)) {
            throw new IllegalArgumentException("This device is already linked to a vehicle");
        }

        AdminAssociation assoc = new AdminAssociation(vehicleId, deviceId);
        AdminAssociation saved = adminAssociationRepository.save(assoc);
        
        // After successful association, rename ThingsBoard device to vehicle license plate
        try {
            renameThingsBoardDevice(vehicleId, deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device after admin-assoc create: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
        }
        
        return saved;
    }

    public List<Map<String, Object>> getAllWithDetails() {
        var client = authService.getCurrentClient();
        if (client != null && !"Admin".equalsIgnoreCase(client.getRole())) {
            return adminAssociationRepository.findAllWithDetailsByClientId(client.getId());
        }
        return adminAssociationRepository.findAllWithDetails();
    }

    public AdminAssociation update(Integer id, Integer vehicleId, Integer deviceId) {
        AdminAssociation assoc = adminAssociationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Admin association not found"));

        // Check new vehicle not linked elsewhere
        if (!assoc.getVehicleId().equals(vehicleId) && adminAssociationRepository.existsByVehicleId(vehicleId)) {
            throw new IllegalArgumentException("This vehicle is already linked to another device");
        }
        // Check new device not linked elsewhere  
        if (!assoc.getDeviceId().equals(deviceId) && adminAssociationRepository.existsByDeviceId(deviceId)) {
            throw new IllegalArgumentException("This device is already linked to another vehicle");
        }

        Integer oldVehicleId = assoc.getVehicleId();
        Integer oldDeviceId = assoc.getDeviceId();
        
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        AdminAssociation saved = adminAssociationRepository.save(assoc);
        
        // If device changed or vehicle changed, rename ThingsBoard device
        if (!oldVehicleId.equals(vehicleId) || !oldDeviceId.equals(deviceId)) {
            try {
                renameThingsBoardDevice(vehicleId, deviceId);
            } catch (Exception e) {
                log.error("Failed to rename TB device after admin-assoc update: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
            }
        }
        
        return saved;
    }

    public void delete(Integer id) {
        AdminAssociation assoc = adminAssociationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Admin association not found"));
        
        Integer deviceId = assoc.getDeviceId();
        adminAssociationRepository.deleteById(id);
        
        // After deletion, rename ThingsBoard device back to original Device ID
        try {
            renameThingsBoardDeviceToOriginal(deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device back to original after admin-assoc delete: deviceId={} error={}", deviceId, e.getMessage(), e);
        }
    }

    // ── Vehicle-Device dropdown (all vehicles with admin-linked devices, for full-assoc form) ────────────
    public List<Map<String, Object>> getVehiclesWithDevice() {
        return adminAssociationRepository.findVehiclesWithAdminDevice(null);
    }

    // ── All drivers dropdown (admin can see all drivers) ────────────────────────────────────
    public List<Map<String, Object>> getAllDrivers() {
        return driverRepository.findAllDriversForDropdown();
    }
    // ── Helpers ───────────────────────────────────────────────────────────────
    
    /**
     * Rename ThingsBoard device to vehicle's license plate.
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
        log.info("TB device renamed: vehicleId={} deviceId={} licensePlate={}", vehicleId, deviceId, licensePlate);
    }
    
    /**
     * Rename ThingsBoard device back to its original Device ID (on association deletion).
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
        log.info("TB device renamed back to original: deviceId={} originalName={}", deviceId, originalDeviceCode);
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
    // ── Full (Vehicle-Device-Driver) associations CRUD ─────────────────────────────────
    public Association createFullAssociation(Integer vehicleId, Integer deviceId, Integer driverId,
                                              String country, Boolean status) {
        if (associationRepository.findByVehicleIdAndDeviceIdAndDriverId(vehicleId, deviceId, driverId).isPresent()) {
            throw new IllegalArgumentException("This Vehicle-Device-Driver association already exists");
        }
        Association assoc = new Association();
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        assoc.setCreatedAt(LocalDateTime.now());
        Association saved = associationRepository.save(assoc);
        
        // After successful association, rename ThingsBoard device to vehicle license plate
        try {
            renameThingsBoardDevice(vehicleId, deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device after full-assoc create: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
        }
        
        return saved;
    }

    public List<Map<String, Object>> getAllFullAssociations() {
        return associationRepository.findAllWithDetails();
    }

    public Association updateFullAssociation(Integer id, Integer vehicleId, Integer deviceId,
                                              Integer driverId, String country, Boolean status) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));
        
        Integer oldVehicleId = assoc.getVehicleId();
        Integer oldDeviceId = assoc.getDeviceId();
        
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        Association saved = associationRepository.save(assoc);
        
        // If device changed or vehicle changed, rename ThingsBoard device
        if (!oldVehicleId.equals(vehicleId) || !oldDeviceId.equals(deviceId)) {
            try {
                renameThingsBoardDevice(vehicleId, deviceId);
            } catch (Exception e) {
                log.error("Failed to rename TB device after full-assoc update: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
            }
        }
        
        return saved;
    }

    public void deleteFullAssociation(Integer id) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));
        
        Integer deviceId = assoc.getDeviceId();
        associationRepository.deleteById(id);
        
        // After deletion, rename ThingsBoard device back to original Device ID
        try {
            renameThingsBoardDeviceToOriginal(deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device back to original after full-assoc delete: deviceId={} error={}", deviceId, e.getMessage(), e);
        }
    }
}

