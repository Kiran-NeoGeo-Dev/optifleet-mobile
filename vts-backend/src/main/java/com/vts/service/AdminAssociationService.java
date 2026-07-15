package com.vts.service;

import com.vts.entity.AdminAssociation;
import com.vts.entity.Association;
import com.vts.entity.Device;
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

import java.util.List;
import java.util.Map;

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

    // -- Dropdowns --
    public List<Map<String, Object>> getVehiclesDropdown() {
        return getVehiclesDropdown(null);
    }

    public List<Map<String, Object>> getVehiclesDropdown(Integer excludeId) {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return adminAssociationRepository.findVehiclesDropdown(excludeId);
        return adminAssociationRepository.findVehiclesDropdownByOrgId(client.getOrgId(), excludeId);
    }

    public List<Map<String, Object>> getAvailableDevices() {
        return getAvailableDevices(null);
    }

    public List<Map<String, Object>> getAvailableDevices(Integer excludeId) {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return adminAssociationRepository.findAvailableDevices(excludeId);
        return adminAssociationRepository.findAvailableDevicesByOrgId(client.getOrgId(), excludeId);
    }

    // -- CRUD --
    public AdminAssociation create(Integer vehicleId, Integer deviceId) {
        validatePair(vehicleId, deviceId);
        if (adminAssociationRepository.existsByVehicleId(vehicleId)) {
            throw new IllegalArgumentException("This vehicle is already linked to a device");
        }
        if (adminAssociationRepository.existsByDeviceId(deviceId)) {
            throw new IllegalArgumentException("This device is already linked to a vehicle");
        }

        AdminAssociation assoc = new AdminAssociation(vehicleId, deviceId);
        AdminAssociation saved = adminAssociationRepository.save(assoc);
        try {
            renameThingsBoardDevice(vehicleId, deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device after admin-assoc create: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
        }
        return saved;
    }

    public List<Map<String, Object>> getAllWithDetails() {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return adminAssociationRepository.findAllWithDetails();
        return adminAssociationRepository.findAllWithDetailsByOrgId(client.getOrgId());
    }

    public AdminAssociation update(Integer id, Integer vehicleId, Integer deviceId) {
        AdminAssociation assoc = adminAssociationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Admin association not found"));
        requireAssociationAccess(assoc);
        validatePair(vehicleId, deviceId);

        if (!assoc.getVehicleId().equals(vehicleId) && adminAssociationRepository.existsByVehicleId(vehicleId)) {
            throw new IllegalArgumentException("This vehicle is already linked to another device");
        }
        if (!assoc.getDeviceId().equals(deviceId) && adminAssociationRepository.existsByDeviceId(deviceId)) {
            throw new IllegalArgumentException("This device is already linked to another vehicle");
        }

        Integer oldVehicleId = assoc.getVehicleId();
        Integer oldDeviceId = assoc.getDeviceId();
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        AdminAssociation saved = adminAssociationRepository.save(assoc);
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
        requireAssociationAccess(assoc);
        Integer deviceId = assoc.getDeviceId();
        adminAssociationRepository.deleteById(id);
        try {
            renameThingsBoardDeviceToOriginal(deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device back to original after admin-assoc delete: deviceId={} error={}", deviceId, e.getMessage(), e);
        }
    }

    // -- Vehicle-Device dropdown for full-assoc form (excludeAssocId lets current vehicle through on edit) --
    public List<Map<String, Object>> getVehiclesWithDevice() {
        return getVehiclesWithDevice(null);
    }

    public List<Map<String, Object>> getVehiclesWithDevice(Integer excludeAssocId) {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client))
            return adminAssociationRepository.findVehiclesWithAdminDevice(null, excludeAssocId);
        return adminAssociationRepository.findVehiclesWithAdminDeviceByOrgId(client.getOrgId(), excludeAssocId);
    }

    // -- Drivers dropdown (excludes already-associated drivers, allows current on edit) --
    public List<Map<String, Object>> getAllDrivers() {
        return getUnassociatedDrivers(null);
    }

    public List<Map<String, Object>> getUnassociatedDrivers(Integer excludeAssocId) {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client))
            return adminAssociationRepository.findUnassociatedDriversAll(excludeAssocId);
        return adminAssociationRepository.findUnassociatedDriversByOrgId(client.getOrgId(), excludeAssocId);
    }

    // -- Full (Vehicle-Device-Driver) associations CRUD --
    public Association createFullAssociation(Integer vehicleId, Integer deviceId, Integer driverId,
                                              String country, Boolean status) {
        Vehicle vehicle = validateFullResources(vehicleId, deviceId, driverId);
        if (associationRepository.findByVehicleIdAndDeviceIdAndDriverId(vehicleId, deviceId, driverId).isPresent()) {
            throw new IllegalArgumentException("This Vehicle-Device-Driver association already exists");
        }
        Association assoc = new Association();
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        assoc.setCreatedAt(java.time.LocalDateTime.now());
        assoc.setClientId(vehicle.getClientId());
        Association saved = associationRepository.save(assoc);
        try {
            renameThingsBoardDevice(vehicleId, deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device after full-assoc create: vehicleId={} deviceId={} error={}", vehicleId, deviceId, e.getMessage(), e);
        }
        return saved;
    }

    public List<Map<String, Object>> getAllFullAssociations() {
        var client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return associationRepository.findAllWithDetails();
        return associationRepository.findAllWithDetailsByOrgId(client.getOrgId());
    }

    public Association updateFullAssociation(Integer id, Integer vehicleId, Integer deviceId,
                                              Integer driverId, String country, Boolean status) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));
        requireFullAssociationAccess(assoc);
        Vehicle vehicle = validateFullResources(vehicleId, deviceId, driverId);
        assoc.setClientId(vehicle.getClientId());
        Integer oldVehicleId = assoc.getVehicleId();
        Integer oldDeviceId  = assoc.getDeviceId();
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        Association saved = associationRepository.save(assoc);
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
        requireFullAssociationAccess(assoc);
        Integer deviceId = assoc.getDeviceId();
        associationRepository.deleteById(id);
        try {
            renameThingsBoardDeviceToOriginal(deviceId);
        } catch (Exception e) {
            log.error("Failed to rename TB device back after full-assoc delete: deviceId={} error={}", deviceId, e.getMessage(), e);
        }
    }

    // -- Helpers --
    private void renameThingsBoardDevice(Integer vehicleId, Integer deviceId) {
        tbDeviceService.renameForAssociation(vehicleId, deviceId, vehicleRepository, deviceRepository, deviceTbMappingRepository);
    }

    private void renameThingsBoardDeviceToOriginal(Integer deviceId) {
        tbDeviceService.renameToOriginal(deviceId, deviceRepository, deviceTbMappingRepository);
    }

    private Vehicle validatePair(Integer vehicleId, Integer deviceId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found"));
        Device device = deviceRepository.findById(deviceId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Device not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
        authService.requireOrgAccess(device.getOrgId(), device.getClientId());
        if (!java.util.Objects.equals(vehicle.getOrgId(), device.getOrgId()))
            throw new IllegalArgumentException("Vehicle and device must belong to the same organization");
        return vehicle;
    }

    private Vehicle validateFullResources(Integer vehicleId, Integer deviceId, Integer driverId) {
        Vehicle vehicle = validatePair(vehicleId, deviceId);
        var driver = driverRepository.findById(driverId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
        authService.requireOrgAccess(driver.getOrgId(), driver.getClientId());
        if (!java.util.Objects.equals(vehicle.getOrgId(), driver.getOrgId()))
            throw new IllegalArgumentException("Vehicle, device and driver must belong to the same organization");
        return vehicle;
    }

    private void requireAssociationAccess(AdminAssociation assoc) {
        Vehicle vehicle = vehicleRepository.findById(assoc.getVehicleId().longValue())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
    }

    private void requireFullAssociationAccess(Association assoc) {
        Vehicle vehicle = vehicleRepository.findById(assoc.getVehicleId().longValue())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
    }
}
