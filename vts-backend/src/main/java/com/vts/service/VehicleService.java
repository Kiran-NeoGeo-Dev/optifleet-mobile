package com.vts.service;

import com.vts.dto.VehicleRequest;
import com.vts.entity.Client;
import com.vts.entity.Trip;
import com.vts.entity.Vehicle;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.TripRepository;
import com.vts.repository.VehicleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class VehicleService {

    private static final Logger log = LoggerFactory.getLogger(VehicleService.class);

    private final VehicleRepository vehicleRepository;
    private final TripRepository    tripRepository;
    private final AuthService       authService;

    public VehicleService(VehicleRepository vehicleRepository, TripRepository tripRepository, 
                          AuthService authService) {
        this.vehicleRepository = vehicleRepository;
        this.tripRepository    = tripRepository;
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
        Long ownerId = authService.resolveResourceOwner(request.getClientId());
        vehicle.setClientId(ownerId);
        vehicle.setOrgId(authService.resolveResourceOrgId(ownerId));
        vehicle.setCreatedAt(LocalDateTime.now());
        return vehicleRepository.save(vehicle);
    }

    // Admin: all vehicles; Client: only their vehicles
    public List<Vehicle> getVehiclesForCurrentRole() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return vehicleRepository.findAll();
        if (authService.isAdmin(client)) return vehicleRepository.findByOrgId(client.getOrgId());
        return vehicleRepository.findByClientId(client.getId());
    }

    // Admin: all vehicles
    public List<Vehicle> getAllVehicles() {
        return getVehiclesForCurrentRole();
    }

    // Client: only their vehicles
    public List<Vehicle> getVehiclesForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        return vehicleRepository.findByClientId(client.getId());
    }

    public Vehicle getVehicle(Long vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vehicle not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
        return vehicle;
    }

    public void deleteVehicle(Long vehicleId) {
        Vehicle vehicle = getVehicle(vehicleId);
        vehicleRepository.delete(vehicle);
    }

    @Transactional
    public Vehicle updateVehicle(Long vehicleId, VehicleRequest request) {
        Vehicle vehicle = getVehicle(vehicleId);
        String oldRegistrationNo = vehicle.getLicensePlate();
        
        mapRequestToEntity(request, vehicle);
        // Fix: update clientId when admin reassigns vehicle to different user (FIX BUG-003)
        if (request.getClientId() != null) {
            try {
                Long ownerId = authService.resolveResourceOwner(request.getClientId());
                vehicle.setClientId(ownerId);
                vehicle.setOrgId(authService.resolveResourceOrgId(ownerId));
            } catch (Exception e) {
                // Log error and keep existing clientId if resolution fails
                log.warn("Failed to resolve clientId {}: {}", request.getClientId(), e.getMessage());
            }
        }
        Vehicle savedVehicle = vehicleRepository.save(vehicle);
        
        // BUG-008: Synchronize vehicle registration number across all trips when it changes
        String newRegistrationNo = savedVehicle.getLicensePlate();
        if (newRegistrationNo != null && !newRegistrationNo.equals(oldRegistrationNo)) {
            List<Trip> trips = tripRepository.findByVehicleId(oldRegistrationNo);
            if (!trips.isEmpty()) {
                log.info("[VehicleService] Synchronizing vehicle ID from '{}' to '{}' across {} trips", 
                         oldRegistrationNo, newRegistrationNo, trips.size());
                for (Trip trip : trips) {
                    trip.setVehicleId(newRegistrationNo);
                }
                tripRepository.saveAll(trips);
            }
        }
        
        return savedVehicle;
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
        // BUG-003: Validate Manufacturing Date is not in the future
        if (mfgDate != null) {
            if (mfgDate.isAfter(LocalDate.now())) {
                throw new IllegalArgumentException("Manufacturing Date cannot be a future date.");
            }
            vehicle.setDateOfManufacturing(mfgDate);
        }
        if (request.getFuelType() != null)            vehicle.setFuelType(request.getFuelType());
        if (request.getInsuranceNumber() != null)     vehicle.setInsuranceNumber(request.getInsuranceNumber());
        LocalDate insDate = parseDate(request.getVehicleInsuranceDate());
        // BUG-004 & BUG-005: Validate Insurance Date >= Registration Date
        if (insDate != null) {
            if (regDate != null && insDate.isBefore(regDate)) {
                throw new IllegalArgumentException("Insurance Date cannot be earlier than Vehicle Registration Date.");
            }
            vehicle.setInsuranceDate(insDate);
        }
        LocalDate pucDate = parseDate(request.getLastPucDate());
        if (pucDate != null)                          vehicle.setLastPucDate(pucDate);
        LocalDate pucDue = parseDate(request.getPucDueOn());
        if (pucDue != null)                           vehicle.setPucDueOn(pucDue);
        if (request.getVehiclePhoto() != null)        vehicle.setVehiclePhoto(request.getVehiclePhoto());
    }
}
