package com.vts.service;

import com.vts.utils.HaversineDistance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * DistanceTrackingService
 * 
 * Calculates and tracks actual distance travelled for vehicles, devices, drivers,
 * trips, and associations using Haversine formula on GPS telemetry data.
 * 
 * Key features:
 * - Validates GPS points (non-null, reasonable values)
 * - Filters GPS jitter (< 5 meters movement)
 * - Filters excessive jumps (> 500 meters in one update = likely GPS error)
 * - Updates all relevant tables atomically
 * - Backend is single source of truth
 */
@Service
public class DistanceTrackingService {

    private static final Logger log = LoggerFactory.getLogger(DistanceTrackingService.class);
    
    // GPS validation thresholds
    private static final double MIN_DISTANCE_METERS = 5.0;      // Ignore movements < 5m (GPS jitter)
    private static final double MAX_DISTANCE_METERS = 500.0;    // Ignore movements > 500m (GPS error/jump)
    
    private final JdbcTemplate jdbc;
    private final HaversineDistance haversine;

    public DistanceTrackingService(JdbcTemplate jdbc, HaversineDistance haversine) {
        this.jdbc = jdbc;
        this.haversine = haversine;
    }

    /**
     * Process GPS telemetry and update distance travelled for all entities.
     * 
     * @param vehicleId vehicle registration number (e.g., "TS08JF0747")
     * @param lat current latitude
     * @param lng current longitude
     * @param tripId optional trip ID if vehicle is on an active trip
     */
    @Transactional
    public void updateDistanceTravelled(String vehicleId, Double lat, Double lng, String tripId) {
        if (!isValidGPS(lat, lng)) {
            log.debug("Invalid GPS for {}: lat={}, lng={}", vehicleId, lat, lng);
            return;
        }

        try {
            // Get vehicle DB ID and last known position
            Map<String, Object> vehicleData = getVehicleData(vehicleId);
            if (vehicleData == null) {
                log.warn("Vehicle {} not found in database", vehicleId);
                return;
            }

            Long vehicleDbId = toLong(vehicleData.get("id"));
            Double lastLat = toDouble(vehicleData.get("last_lat"));
            Double lastLng = toDouble(vehicleData.get("last_lng"));
            Double currentKm = toDouble(vehicleData.get("km_travelled"));

            // If no previous position, just store current position
            if (lastLat == null || lastLng == null) {
                storeLastPosition(vehicleId, lat, lng);
                log.info("Initialized GPS position for vehicle {}: {}, {}", vehicleId, lat, lng);
                return;
            }

            // Calculate distance using Haversine formula
            double distanceMeters = haversine.calculateDistance(lastLat, lastLng, lat, lng);

            // Validate distance (filter jitter and GPS errors)
            if (distanceMeters < MIN_DISTANCE_METERS) {
                log.debug("Distance too small for {}: {}m - likely GPS jitter", vehicleId, distanceMeters);
                // Still update position for next calculation
                storeLastPosition(vehicleId, lat, lng);
                return;
            }

            if (distanceMeters > MAX_DISTANCE_METERS) {
                log.warn("Distance too large for {}: {}m - likely GPS error/jump, skipping", vehicleId, distanceMeters);
                return;
            }

            double distanceKm = distanceMeters / 1000.0;
            double newTotalKm = (currentKm != null ? currentKm : 0.0) + distanceKm;

            log.info("Distance update for {}: +{:.3f}km (total: {:.3f}km)", vehicleId, distanceKm, newTotalKm);

            // Update vehicle
            updateVehicleDistance(vehicleDbId, newTotalKm, lat, lng);

            // Update device (via admin_associations)
            updateDeviceDistance(vehicleDbId, distanceKm);

            // Update driver and association (via associations)
            updateDriverAndAssociationDistance(vehicleDbId, distanceKm);

            // Update trip if active
            if (tripId != null && !tripId.isEmpty()) {
                updateTripDistance(tripId, distanceKm, lat, lng);
            }

            // Store new last position
            storeLastPosition(vehicleId, lat, lng);

        } catch (Exception e) {
            log.error("Failed to update distance for vehicle {}: {}", vehicleId, e.getMessage(), e);
        }
    }

    /**
     * Validate GPS coordinates
     */
    private boolean isValidGPS(Double lat, Double lng) {
        if (lat == null || lng == null) return false;
        if (lat == 0.0 && lng == 0.0) return false; // Invalid (0,0) point
        if (lat < -90 || lat > 90) return false;
        if (lng < -180 || lng > 180) return false;
        return true;
    }

    /**
     * Get vehicle data including last GPS position
     */
    private Map<String, Object> getVehicleData(String registrationNo) {
        try {
            return jdbc.queryForMap("""
                SELECT v.id, v.km_travelled,
                       t.last_tracked_lat AS last_lat,
                       t.last_tracked_lng AS last_lng
                FROM vehicles v
                LEFT JOIN LATERAL (
                    SELECT last_tracked_lat, last_tracked_lng
                    FROM trips
                    WHERE vehicle_id = v.registration_no
                      AND TRIM(status) NOT IN ('Completed', 'Cancelled')
                    ORDER BY created_at DESC
                    LIMIT 1
                ) t ON TRUE
                WHERE v.registration_no = ?
                """, registrationNo);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Store last GPS position in the trip table
     */
    private void storeLastPosition(String vehicleId, Double lat, Double lng) {
        jdbc.update("""
            UPDATE trips
            SET last_tracked_lat = ?,
                last_tracked_lng = ?,
                last_tracked_at = NOW()
            WHERE vehicle_id = ?
              AND TRIM(status) NOT IN ('Completed', 'Cancelled')
            """, lat, lng, vehicleId);
    }

    /**
     * Update vehicle km_travelled
     */
    private void updateVehicleDistance(Long vehicleId, Double totalKm, Double lat, Double lng) {
        int updated = jdbc.update("""
            UPDATE vehicles
            SET km_travelled = ?
            WHERE id = ?
            """, totalKm, vehicleId);
        
        if (updated > 0) {
            log.debug("Updated vehicle {} distance to {:.3f}km", vehicleId, totalKm);
        }
    }

    /**
     * Update device km_travelled via admin_associations
     */
    private void updateDeviceDistance(Long vehicleId, Double distanceKm) {
        int updated = jdbc.update("""
            UPDATE devices d
            SET km_travelled = d.km_travelled + ?
            WHERE id IN (
                SELECT device_id
                FROM admin_associations
                WHERE vehicle_id = ?
            )
            """, distanceKm, vehicleId);

        if (updated > 0) {
            log.debug("Updated {} device(s) distance by {:.3f}km for vehicle {}", updated, distanceKm, vehicleId);
        }

        // Also update admin_associations table
        jdbc.update("""
            UPDATE admin_associations
            SET km_travelled = km_travelled + ?
            WHERE vehicle_id = ?
            """, distanceKm, vehicleId);
    }

    /**
     * Update driver and association km_travelled via associations
     */
    private void updateDriverAndAssociationDistance(Long vehicleId, Double distanceKm) {
        // Update driver
        int driverUpdated = jdbc.update("""
            UPDATE drivers d
            SET km_travelled = d.km_travelled + ?
            WHERE id IN (
                SELECT driver_id
                FROM associations
                WHERE vehicle_id = ? AND status = true
            )
            """, distanceKm, vehicleId);

        if (driverUpdated > 0) {
            log.debug("Updated {} driver(s) distance by {:.3f}km for vehicle {}", driverUpdated, distanceKm, vehicleId);
        }

        // Update associations table
        jdbc.update("""
            UPDATE associations
            SET km_travelled = km_travelled + ?
            WHERE vehicle_id = ? AND status = true
            """, distanceKm, vehicleId);
    }

    /**
     * Update trip distance_traveled_km
     */
    private void updateTripDistance(String tripId, Double distanceKm, Double lat, Double lng) {
        int updated = jdbc.update("""
            UPDATE trips
            SET distance_traveled_km = distance_traveled_km + ?,
                last_tracked_lat = ?,
                last_tracked_lng = ?,
                last_tracked_at = NOW(),
                updated_at = NOW()
            WHERE trip_id = ?
              AND TRIM(status) NOT IN ('Completed', 'Cancelled')
            """, distanceKm, lat, lng, tripId);

        if (updated > 0) {
            log.debug("Updated trip {} distance by {:.3f}km", tripId, distanceKm);
        }
    }

    /**
     * Helper to safely convert Object to Long
     */
    private Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        return null;
    }

    /**
     * Helper to safely convert Object to Double
     */
    private Double toDouble(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).doubleValue();
        return null;
    }
}
