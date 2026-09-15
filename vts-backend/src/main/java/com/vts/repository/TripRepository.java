package com.vts.repository;

import com.vts.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TripRepository extends JpaRepository<Trip, Long> {
    List<Trip> findByClientIdOrderByCreatedAtDesc(Long clientId);
    long countByClientId(Long clientId);
    void deleteByClientId(Long clientId);

    @Query(value =
        "SELECT t.* FROM public.trips t " +
        "INNER JOIN public.vehicles v ON v.registration_no = t.vehicle_id " +
        "WHERE v.client_id = :clientId " +
        "ORDER BY t.created_at DESC",
        nativeQuery = true)
    List<Trip> findByVehicleClientId(@Param("clientId") Long clientId);

    @Query(value =
        "SELECT COUNT(*) FROM public.trips t " +
        "INNER JOIN public.vehicles v ON v.registration_no = t.vehicle_id " +
        "WHERE v.client_id = :clientId",
        nativeQuery = true)
    long countByVehicleClientId(@Param("clientId") Long clientId);

    @Query(value =
        "SELECT t.* FROM public.trips t INNER JOIN public.vehicles v ON v.registration_no = t.vehicle_id " +
        "WHERE v.org_id = :orgId ORDER BY t.created_at DESC", nativeQuery = true)
    List<Trip> findByVehicleOrgId(@Param("orgId") Long orgId);

    @Query(value =
        "SELECT COUNT(*) FROM public.trips t INNER JOIN public.vehicles v ON v.registration_no = t.vehicle_id " +
        "WHERE v.org_id = :orgId", nativeQuery = true)
    long countByVehicleOrgId(@Param("orgId") Long orgId);

    @Query(value = "SELECT COUNT(*) > 0 FROM public.trips WHERE vehicle_id = :vehicleId AND driver_id = :driverId AND TRIM(status) NOT IN ('Completed', 'Cancelled')",
        nativeQuery = true)
    boolean existsByVehicleIdAndDriverId(@Param("vehicleId") String vehicleId, @Param("driverId") Integer driverId);

    @Query(value =
        "SELECT t.id, t.trip_id, t.trip_name, t.vehicle_id, t.driver_id, t.driver_name, " +
        "t.start_place, t.end_place, t.start_lat, t.start_lng, t.end_lat, t.end_lng, " +
        "t.distance_km, t.duration, t.status, t.client_id, t.created_by, t.created_at, t.updated_at, " +
        "t.custom_polyline, t.planned_end_time, " +
        "t.start_date, t.end_date, t.started_at, t.travelled_distance_km, t.distance_traveled_km, " +
        "t.last_tracked_lat, t.last_tracked_lng " +
        "FROM public.trips t " +
        "INNER JOIN public.drivers d ON t.driver_id = d.id " +
        "WHERE t.driver_id = :driverId " +
        "AND TRIM(t.status) NOT IN ('Completed', 'Cancelled') " +
        "ORDER BY t.created_at DESC LIMIT 1",
        nativeQuery = true)
    Optional<Trip> findActiveByDriverId(@Param("driverId") Long driverId);

    // BUG-007: Find all trips for a driver (for name synchronization)
    @Query(value = "SELECT * FROM public.trips WHERE driver_id = :driverId", nativeQuery = true)
    List<Trip> findByDriverId(@Param("driverId") Integer driverId);

    // BUG-008: Find all trips for a vehicle (for registration number synchronization)
    @Query(value = "SELECT * FROM public.trips WHERE vehicle_id = :vehicleId", nativeQuery = true)
    List<Trip> findByVehicleId(@Param("vehicleId") String vehicleId);
}
