package com.vts.service;

import com.vts.entity.AdminAssociation;
import com.vts.entity.Client;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.DeviceRepository;
import com.vts.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AdminAssociationService {

    private final AdminAssociationRepository adminAssociationRepository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;
    private final AuthService authService;

    public AdminAssociationService(AdminAssociationRepository adminAssociationRepository,
                                   VehicleRepository vehicleRepository,
                                   DeviceRepository deviceRepository,
                                   AuthService authService) {
        this.adminAssociationRepository = adminAssociationRepository;
        this.vehicleRepository = vehicleRepository;
        this.deviceRepository = deviceRepository;
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
}

