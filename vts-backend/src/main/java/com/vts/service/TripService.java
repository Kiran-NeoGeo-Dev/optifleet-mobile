package com.vts.service;

import com.vts.dto.TripRequest;
import com.vts.entity.Client;
import com.vts.entity.Trip;
import com.vts.entity.TripStop;
import com.vts.repository.AssociationRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.TripRepository;
import com.vts.repository.TripStopRepository;
import com.vts.repository.VehicleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class TripService {

    private final TripRepository        tripRepository;
    private final DriverRepository      driverRepository;
    private final AuthService           authService;
    private final VehicleRepository     vehicleRepository;
    private final AssociationRepository associationRepository;
    private final TripStopRepository    tripStopRepository;

    public TripService(TripRepository tripRepository, DriverRepository driverRepository, AuthService authService,
                       VehicleRepository vehicleRepository, AssociationRepository associationRepository,
                       TripStopRepository tripStopRepository) {
        this.tripRepository        = tripRepository;
        this.driverRepository      = driverRepository;
        this.authService           = authService;
        this.vehicleRepository     = vehicleRepository;
        this.associationRepository = associationRepository;
        this.tripStopRepository    = tripStopRepository;
    }

    @Transactional
    public Trip createTrip(TripRequest req) {
        // Block duplicate: one active trip per vehicle + driver
        if (req.getVehicleId() != null && req.getDriverId() != null
                && tripRepository.existsByVehicleIdAndDriverId(req.getVehicleId(), req.getDriverId())) {
            throw new IllegalStateException(
                "Trip already exists for this vehicle and driver. Please complete or cancel the existing trip before creating a new one."
            );
        }
        Client client = authService.getCurrentClient();
        var vehicle = vehicleRepository.findByLicensePlate(req.getVehicleId())
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
        if (req.getDriverId() != null) {
            var driver = driverRepository.findById(req.getDriverId().longValue())
                    .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
            authService.requireOrgAccess(driver.getOrgId(), driver.getClientId());
            if (!java.util.Objects.equals(vehicle.getOrgId(), driver.getOrgId()))
                throw new IllegalArgumentException("Vehicle and driver must belong to the same organization");
        }
        Trip trip = new Trip();
        trip.setTripId(req.getTripId());
        trip.setTripName(req.getTripName() != null ? req.getTripName() : req.getTripId());
        trip.setVehicleId(req.getVehicleId());
        trip.setDriverName(req.getDriverName());
        trip.setStartPlace(req.getStartPlace());
        trip.setEndPlace(req.getEndPlace());
        trip.setStartLat(req.getStartLat());
        trip.setStartLng(req.getStartLng());
        trip.setEndLat(req.getEndLat());
        trip.setEndLng(req.getEndLng());
        trip.setDistanceKm(req.getDistanceKm());
        trip.setDuration(req.getDuration());
        trip.setCustomPolyline(req.getCustomPolyline());
        trip.setDriverId(req.getDriverId());
        trip.setStatus("Not Started");
        OffsetDateTime now = OffsetDateTime.now();
        trip.setCreatedAt(now);
        trip.setUpdatedAt(now);
        trip.setPlannedEndTime(parsePlannedEndTime(req.getDuration(), now));
        if (client != null) {
            trip.setClientId(vehicle.getClientId());
            trip.setCreatedBy(client.getUsername());
        }
        Trip saved = tripRepository.save(trip);
        saveTripStops(saved.getTripId(), req.getTripStops());
        return saved;
    }

    private void saveTripStops(String tripId, List<TripRequest.TripStopRequest> stops) {
        if (stops == null || stops.isEmpty()) return;
        OffsetDateTime now = OffsetDateTime.now();
        for (int i = 0; i < stops.size(); i++) {
            TripRequest.TripStopRequest s = stops.get(i);
            if (s.getPlace() == null || s.getLat() == null || s.getLng() == null) continue;
            TripStop ts = new TripStop();
            ts.setTripId(tripId);
            ts.setStopOrder(i + 1);
            ts.setStopName(s.getPlace());
            ts.setLat(BigDecimal.valueOf(s.getLat()));
            ts.setLng(BigDecimal.valueOf(s.getLng()));
            ts.setCreatedAt(now);
            tripStopRepository.save(ts);
        }
    }

    public List<TripStop> getStopsForTrip(Long tripId) {
        Trip trip = tripRepository.findById(tripId)
            .orElseThrow(() -> new RuntimeException("Trip not found: " + tripId));
        requireTripAccess(trip);
        return tripStopRepository.findByTripIdOrderByStopOrderAsc(trip.getTripId());
    }

    public List<Trip> getTripsForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return tripRepository.findAll();
        if (authService.isAdmin(client)) return tripRepository.findByVehicleOrgId(client.getOrgId());
        return tripRepository.findByVehicleClientId(client.getId());
    }

    public long countTripsForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return 0;
        if (authService.isSuperAdmin(client)) return tripRepository.count();
        if (authService.isAdmin(client)) return tripRepository.countByVehicleOrgId(client.getOrgId());
        return tripRepository.countByVehicleClientId(client.getId());
    }

    /** Resolve driver's numeric ID from JWT claim or username fallback. */
    public Long resolveDriverId(String username, Object claimValue) {
        if (claimValue != null) {
            try { return Long.parseLong(claimValue.toString()); } catch (Exception ignored) {}
        }
        return driverRepository.findByUsername(username)
            .map(d -> d.getId())
            .orElse(null);
    }

    /** Return the latest trip for a driver (any status), joined on drivers.id. */
    public Optional<Trip> findActiveTrip(Long driverId) {
        return tripRepository.findActiveByDriverId(driverId);
    }

    @Transactional
    public Trip updateTrip(Long id, TripRequest req) {
        Trip trip = tripRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Trip not found: " + id));
        requireTripAccess(trip);
        if (req.getVehicleId() != null || req.getDriverId() != null || req.getDriverName() != null) {
            updateTripVehicleAndDriver(trip, req);
        }
        if (req.getStartPlace()     != null) trip.setStartPlace(req.getStartPlace());
        if (req.getEndPlace()       != null) trip.setEndPlace(req.getEndPlace());
        if (req.getStartLat()       != null) trip.setStartLat(req.getStartLat());
        if (req.getStartLng()       != null) trip.setStartLng(req.getStartLng());
        if (req.getEndLat()         != null) trip.setEndLat(req.getEndLat());
        if (req.getEndLng()         != null) trip.setEndLng(req.getEndLng());
        if (req.getDistanceKm()     != null) trip.setDistanceKm(req.getDistanceKm());
        if (req.getDuration()       != null) {
            trip.setDuration(req.getDuration());
            trip.setPlannedEndTime(parsePlannedEndTime(req.getDuration(), trip.getCreatedAt()));
        }
        if (req.getCustomPolyline() != null) trip.setCustomPolyline(req.getCustomPolyline());
        trip.setUpdatedAt(OffsetDateTime.now());
        Trip saved = tripRepository.save(trip);
        if (req.getTripStops() != null) {
            tripStopRepository.deleteByTripId(saved.getTripId());
            saveTripStops(saved.getTripId(), req.getTripStops());
        }
        return saved;
    }

    private void updateTripVehicleAndDriver(Trip trip, TripRequest req) {
        String vehicleId = req.getVehicleId() != null ? req.getVehicleId() : trip.getVehicleId();
        Integer driverId = req.getDriverId() != null ? req.getDriverId() : trip.getDriverId();
        if (vehicleId == null || driverId == null) {
            throw new IllegalArgumentException("Vehicle and driver are required");
        }
        var vehicle = vehicleRepository.findByLicensePlate(vehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Vehicle not found"));
        var driver = driverRepository.findById(driverId.longValue())
                .orElseThrow(() -> new IllegalArgumentException("Driver not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
        authService.requireOrgAccess(driver.getOrgId(), driver.getClientId());
        if (!java.util.Objects.equals(vehicle.getOrgId(), driver.getOrgId())) {
            throw new IllegalArgumentException("Vehicle and driver must belong to the same organization");
        }
        if (!associationRepository.existsActiveVehicleDriverAssociation(vehicleId, driverId)) {
            throw new IllegalArgumentException("Selected vehicle does not have a completed driver association");
        }
        trip.setVehicleId(vehicleId);
        trip.setDriverId(driverId);
        trip.setDriverName(req.getDriverName() != null ? req.getDriverName() : driver.getDriverName());
        trip.setClientId(vehicle.getClientId());
    }

    @Transactional
    public void deleteTrip(Long id) {
        Trip trip = tripRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Trip not found: " + id));
        requireTripAccess(trip);
        tripStopRepository.deleteByTripId(trip.getTripId());
        tripRepository.delete(trip);
    }

    private void requireTripAccess(Trip trip) {
        var vehicle = vehicleRepository.findByLicensePlate(trip.getVehicleId())
                .orElseThrow(() -> new IllegalArgumentException("Trip vehicle not found"));
        authService.requireOrgAccess(vehicle.getOrgId(), vehicle.getClientId());
    }

    /**
     * Parse OSRM duration strings like "2.5 hrs", "45 mins", "1 hr 30 mins"
     * and return base + parsed duration as the planned end time.
     */
    static OffsetDateTime parsePlannedEndTime(String duration, OffsetDateTime base) {
        if (duration == null || duration.isBlank() || base == null) return null;
        try {
            String d = duration.trim().toLowerCase();
            double totalMinutes = 0;
            java.util.regex.Matcher hm = java.util.regex.Pattern.compile("([\\d.]+)\\s*hr").matcher(d);
            if (hm.find()) totalMinutes += Double.parseDouble(hm.group(1)) * 60;
            java.util.regex.Matcher mm = java.util.regex.Pattern.compile("([\\d.]+)\\s*min").matcher(d);
            if (mm.find()) totalMinutes += Double.parseDouble(mm.group(1));
            if (totalMinutes == 0) {
                java.util.regex.Matcher nm = java.util.regex.Pattern.compile("^([\\d.]+)$").matcher(d);
                if (nm.find()) totalMinutes = Double.parseDouble(nm.group(1)) * 60;
            }
            if (totalMinutes <= 0) return null;
            return base.plusSeconds((long)(totalMinutes * 60));
        } catch (Exception e) { return null; }
    }
}
