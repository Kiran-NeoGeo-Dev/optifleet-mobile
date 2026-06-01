package com.vts.service;

import com.vts.dto.VehicleRequest;
import com.vts.entity.Client;
import com.vts.entity.Vehicle;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;
    private final AuthService       authService;

    public VehicleService(VehicleRepository vehicleRepository, AuthService authService) {
        this.vehicleRepository = vehicleRepository;
        this.authService       = authService;
    }

    // Handles both "yyyy-MM-dd" and full ISO "yyyy-MM-ddTHH:mm:ss.sssZ"
    private LocalDate parseDate(String value) {
        if (value == null || value.isEmpty()) return null;
        if (value.length() > 10) {
            return Instant.parse(value).atZone(java.time.ZoneOffset.UTC).toLocalDate();
        }
        return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
    }

    public Vehicle createVehicle(VehicleRequest request) {
        Client client = authService.getCurrentClient();
        Vehicle vehicle = new Vehicle();
        mapRequestToEntity(request, vehicle);
        if (request.getClientId() != null) {
            vehicle.setClientId(request.getClientId());
        } else if (client != null) {
            vehicle.setClientId(client.getId());
        }
        vehicle.setCreatedAt(LocalDateTime.now());
        return vehicleRepository.save(vehicle);
    }

    // Admin: all vehicles; Client: only their vehicles
    public List<Vehicle> getVehiclesForCurrentRole() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if ("Admin".equalsIgnoreCase(client.getRole())) return vehicleRepository.findAll();
        return vehicleRepository.findByClientId(client.getId());
    }

    // Admin: all vehicles
    public List<Vehicle> getAllVehicles() {
        return vehicleRepository.findAll();
    }

    // Client: only their vehicles
    public List<Vehicle> getVehiclesForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        return vehicleRepository.findByClientId(client.getId());
    }

    public Vehicle getVehicle(Long vehicleId) {
        return vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
    }

    public Vehicle updateVehicle(Long vehicleId, VehicleRequest request) {
        Vehicle vehicle = getVehicle(vehicleId);
        mapRequestToEntity(request, vehicle);
        // Fix: update clientId when admin reassigns vehicle to different user
        if (request.getClientId() != null) {
            vehicle.setClientId(request.getClientId());
        }
        return vehicleRepository.save(vehicle);
    }

    private void mapRequestToEntity(VehicleRequest request, Vehicle vehicle) {
        if (request.getLicensePlate() != null)       vehicle.setLicensePlate(request.getLicensePlate());
        LocalDate regDate = parseDate(request.getManufactureDate());
        if (regDate != null)                          vehicle.setDateOfRegistration(regDate);
        LocalDate regValidity = parseDate(request.getRegistrationValidity());
        if (regValidity != null)                      vehicle.setRegistrationValidity(regValidity);
        if (request.getChassisNumber() != null)       vehicle.setChassisNumber(request.getChassisNumber());
        if (request.getEngineNumber() != null)        vehicle.setEngineNumber(request.getEngineNumber());
        if (request.getOwnerName() != null)           vehicle.setOwnerName(request.getOwnerName());
        if (request.getVehicleMake() != null)         vehicle.setVehicleMake(request.getVehicleMake());
        if (request.getVehicleModel() != null)        vehicle.setVehicleModel(request.getVehicleModel());
        LocalDate mfgDate = parseDate(request.getDateOfManufacturing());
        if (mfgDate != null)                          vehicle.setDateOfManufacturing(mfgDate);
        if (request.getFuelType() != null)            vehicle.setFuelType(request.getFuelType());
        if (request.getInsuranceNumber() != null)     vehicle.setInsuranceNumber(request.getInsuranceNumber());
        LocalDate insDate = parseDate(request.getVehicleInsuranceDate());
        if (insDate != null)                          vehicle.setInsuranceDate(insDate);
        LocalDate pucDate = parseDate(request.getLastPucDate());
        if (pucDate != null)                          vehicle.setLastPucDate(pucDate);
        LocalDate pucDue = parseDate(request.getPucDueOn());
        if (pucDue != null)                           vehicle.setPucDueOn(pucDue);
        if (request.getVehiclePhoto() != null)        vehicle.setVehiclePhoto(request.getVehiclePhoto());
    }
}
