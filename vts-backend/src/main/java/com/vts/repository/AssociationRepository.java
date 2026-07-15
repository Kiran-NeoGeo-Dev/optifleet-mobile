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

    @Query(value = "SELECT a.* FROM associations a JOIN vehicles v ON v.id = a.vehicle_id WHERE v.org_id = :orgId", nativeQuery = true)
    List<Association> findByOrgId(@Param("orgId") Long orgId);

    @Query(value = "SELECT COUNT(*) FROM associations a JOIN vehicles v ON v.id = a.vehicle_id WHERE v.org_id = :orgId", nativeQuery = true)
    long countByOrgId(@Param("orgId") Long orgId);

    @Query(value = "SELECT a.client_id FROM associations a JOIN vehicles v ON v.id = a.vehicle_id WHERE a.id = :id AND v.org_id = :orgId", nativeQuery = true)
    Optional<Long> findVisibleClientId(@Param("id") Integer id, @Param("orgId") Long orgId);
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

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, a.device_id, d.device_id AS device_code, " +
        "a.driver_id, dr.driver_name, dr.license_no, a.country, a.status, a.created_at " +
        "FROM associations a JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN devices d ON d.id = a.device_id JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE v.org_id = :orgId ORDER BY a.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetailsByOrgId(@Param("orgId") Long orgId);

    // Vehicles that belong to client and have a full association (for exclusion check)
    @Query(value =
        "SELECT a.vehicle_id FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "WHERE v.client_id = :clientId", nativeQuery = true)
    List<Integer> findAssociatedVehicleIdsByClientId(@Param("clientId") Long clientId);

    // Returns vehicles with no active trip (status NOT IN Completed/Cancelled).
    // excludeTripId allows the vehicle of the trip being edited to still appear.
    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.client_id " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE a.client_id = :clientId " +
        "AND a.status = true " +
        "AND NOT EXISTS ( " +
        "  SELECT 1 FROM trips t " +
        "  WHERE t.vehicle_id = v.registration_no " +
        "  AND TRIM(t.status) NOT IN ('Completed', 'Cancelled') " +
        "  AND (:excludeTripId IS NULL OR t.id <> :excludeTripId) " +
        ") " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDriverByClientId(
        @Param("clientId") Long clientId,
        @Param("excludeTripId") Long excludeTripId);

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, " +
        "a.driver_id, dr.driver_name, dr.license_no, " +
        "a.client_id " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE a.status = true " +
        "AND NOT EXISTS ( " +
        "  SELECT 1 FROM trips t " +
        "  WHERE t.vehicle_id = v.registration_no " +
        "  AND TRIM(t.status) NOT IN ('Completed', 'Cancelled') " +
        "  AND (:excludeTripId IS NULL OR t.id <> :excludeTripId) " +
        ") " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDriverAllClients(
        @Param("excludeTripId") Long excludeTripId);

    @Query(value =
        "SELECT a.id, a.vehicle_id, v.registration_no, a.driver_id, dr.driver_name, dr.license_no, a.client_id " +
        "FROM associations a JOIN vehicles v ON v.id = a.vehicle_id JOIN drivers dr ON dr.id = a.driver_id " +
        "WHERE v.org_id = :orgId AND a.status = true " +
        "AND NOT EXISTS ( " +
        "  SELECT 1 FROM trips t " +
        "  WHERE t.vehicle_id = v.registration_no " +
        "  AND TRIM(t.status) NOT IN ('Completed', 'Cancelled') " +
        "  AND (:excludeTripId IS NULL OR t.id <> :excludeTripId) " +
        ") " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDriverByOrgId(
        @Param("orgId") Long orgId,
        @Param("excludeTripId") Long excludeTripId);

    @Query(value =
        "SELECT COUNT(*) > 0 " +
        "FROM associations a " +
        "JOIN vehicles v ON v.id = a.vehicle_id " +
        "WHERE v.registration_no = :registrationNo " +
        "AND a.driver_id = :driverId " +
        "AND a.status = true", nativeQuery = true)
    boolean existsActiveVehicleDriverAssociation(@Param("registrationNo") String registrationNo,
                                                 @Param("driverId") Integer driverId);
}
