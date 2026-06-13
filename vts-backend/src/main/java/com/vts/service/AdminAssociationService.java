package com.vts.service;

import com.vts.entity.AdminAssociation;
import com.vts.entity.Association;
import com.vts.entity.Client;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class AdminAssociationService {

    private final AdminAssociationRepository adminAssociationRepository;
    private final AssociationRepository associationRepository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;
    private final DriverRepository driverRepository;
    private final AuthService authService;

    public AdminAssociationService(AdminAssociationRepository adminAssociationRepository,
                                   AssociationRepository associationRepository,
                                   VehicleRepository vehicleRepository,
                                   DeviceRepository deviceRepository,
                                   DriverRepository driverRepository,
                                   AuthService authService) {
        this.adminAssociationRepository = adminAssociationRepository;
        this.associationRepository = associationRepository;
        this.vehicleRepository = vehicleRepository;
        this.deviceRepository = deviceRepository;
        this.driverRepository = driverRepository;
        this.authService = authService;
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
        return adminAssociationRepository.save(assoc);
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

        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        return adminAssociationRepository.save(assoc);
    }

    public void delete(Integer id) {
        if (!adminAssociationRepository.existsById(id)) {
            throw new RuntimeException("Admin association not found");
        }
        adminAssociationRepository.deleteById(id);
    }

    // ── Vehicle-Device dropdown (all vehicles with admin-linked devices, for full-assoc form) ────────────
    public List<Map<String, Object>> getVehiclesWithDevice() {
        return adminAssociationRepository.findVehiclesWithAdminDevice(null);
    }

    // ── All drivers dropdown (admin can see all drivers) ────────────────────────────────────
    public List<Map<String, Object>> getAllDrivers() {
        return driverRepository.findAllDriversForDropdown();
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
        return associationRepository.save(assoc);
    }

    public List<Map<String, Object>> getAllFullAssociations() {
        return associationRepository.findAllWithDetails();
    }

    public Association updateFullAssociation(Integer id, Integer vehicleId, Integer deviceId,
                                              Integer driverId, String country, Boolean status) {
        Association assoc = associationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Association not found"));
        assoc.setVehicleId(vehicleId);
        assoc.setDeviceId(deviceId);
        assoc.setDriverId(driverId);
        assoc.setCountry(country != null ? country : "India");
        assoc.setStatus(status != null ? status : true);
        return associationRepository.save(assoc);
    }

    public void deleteFullAssociation(Integer id) {
        if (!associationRepository.existsById(id))
            throw new RuntimeException("Association not found");
        associationRepository.deleteById(id);
    }
}

