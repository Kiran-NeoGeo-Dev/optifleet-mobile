package com.vts.repository;

import com.vts.entity.Association;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AssociationRepository extends JpaRepository<Association, Integer> {
    List<Association> findByClientId(Long clientId);
    long countByClientId(Long clientId);
    void deleteByClientId(Long clientId);
    
    // Check if association already exists with same vehicle-device pair
    Optional<Association> findByVehicleIdAndDeviceId(Integer vehicleId, Integer deviceId);

    // Check if association already exists with same vehicle-device-driver combination
    Optional<Association> findByVehicleIdAndDeviceIdAndDriverId(Integer vehicleId, Integer deviceId, Integer driverId);

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.device_id, d.device_id AS device_code, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.country, a.status, a.created_at " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN devices d ON d.id = a.device_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "ORDER BY a.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetails();

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.device_id, d.device_id AS device_code, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.country, a.status, a.created_at " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN devices d ON d.id = a.device_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE a.client_id = :clientId OR (a.client_id IS NULL AND v.client_id = :clientId) " +
        "ORDER BY a.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetailsByClientId(@Param("clientId") Long clientId);

    // Vehicles that belong to client and have a full association (for exclusion check)
    @Query(value =
        "SELECT a.vehicle_id FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "WHERE v.client_id = :clientId", nativeQuery = true)
    List<Integer> findAssociatedVehicleIdsByClientId(@Param("clientId") Long clientId);
    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.client_id " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE a.client_id = :clientId " +
        "AND v.registration_no NOT IN (" +
        "  SELECT t.vehicle_id FROM trips t " +
        "  WHERE TRIM(t.status) NOT IN ('Completed', 'Cancelled')" +
        ") " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDriverByClientId(@Param("clientId") Long clientId);

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.client_id " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE v.registration_no NOT IN (" +
        "  SELECT t.vehicle_id FROM trips t " +
        "  WHERE TRIM(t.status) NOT IN ('Completed', 'Cancelled')" +
        ") " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDriverAllClients();
}
