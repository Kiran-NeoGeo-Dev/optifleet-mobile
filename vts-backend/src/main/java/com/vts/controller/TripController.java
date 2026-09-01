package com.vts.controller;

import com.vts.dto.DriverTripResponse;
import com.vts.dto.TripRequest;
import com.vts.entity.Client;
import com.vts.entity.Trip;
import com.vts.service.AuthService;
import com.vts.service.TripService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;
    private final AuthService authService;

    public TripController(TripService tripService, AuthService authService) {
        this.tripService = tripService;
        this.authService = authService;
    }

    @GetMapping("/{id}/stops")
    public ResponseEntity<List<com.vts.entity.TripStop>> getStops(@PathVariable Long id) {
        return ResponseEntity.ok(tripService.getStopsForTrip(id));
    }

    @PostMapping
    public ResponseEntity<Trip> create(@RequestBody TripRequest req) {
        return ResponseEntity.ok(tripService.createTrip(req));
    }

    @GetMapping
    public ResponseEntity<List<Trip>> list() {
        List<Trip> trips = tripService.getTripsForCurrentClient();
        org.slf4j.LoggerFactory.getLogger(TripController.class)
            .info("GET /api/trips returning {} trips", trips.size());
        for (Trip t : trips) {
            org.slf4j.LoggerFactory.getLogger(TripController.class)
                .info("  - Trip {}: id={}, status={}, vehicleId={}", t.getTripId(), t.getId(), t.getStatus(), t.getVehicleId());
        }
        return ResponseEntity.ok(trips);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Trip> update(@PathVariable Long id, @RequestBody TripRequest req) {
        return ResponseEntity.ok(tripService.updateTrip(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Client client = authService.getCurrentClient();
        if (client == null || (!authService.isAdmin(client) && !authService.isSuperAdmin(client))) {
            return ResponseEntity.status(403).body(Map.of("error", "Only Admin can delete trips"));
        }
        tripService.deleteTrip(id);
        return ResponseEntity.noContent().build();
    }

    /** Driver calls this after login to get their active trip with saved route. */
    @GetMapping("/driver/active")
    public ResponseEntity<?> driverActiveTrip() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return ResponseEntity.status(401).build();

        // Extract driverId from JWT claims (set during driver login in AuthService)
        Object driverIdClaim = null;
        if (auth.getDetails() instanceof Map) {
            driverIdClaim = ((Map<?, ?>) auth.getDetails()).get("driverId");
        }
        // Fallback: resolve via username
        Long driverId = tripService.resolveDriverId(auth.getName(), driverIdClaim);
        if (driverId == null) return ResponseEntity.status(403).build();

        return tripService.findActiveTrip(driverId)
            .map(t -> ResponseEntity.ok((Object) new DriverTripResponse(t, tripService.getStopsForTrip((long) t.getId()))))
            .orElse(ResponseEntity.ok(Map.of("message", "No active trip")));
    }
}
