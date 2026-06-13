package com.vts.repository;

import com.vts.entity.AdminAssociation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public interface AdminAssociationRepository extends JpaRepository<AdminAssociation, Integer> {

    // ── Check existence for uniqueness ─────────────────────────────────────────
    boolean existsByVehicleId(Integer vehicleId);
    boolean existsByDeviceId(Integer deviceId);
    void deleteByVehicleId(Integer vehicleId);
    void deleteByDeviceId(Integer deviceId);

    // ── Get associations with vehicle/device details ──────────────────────────
@Query(value = "SELECT aa.id, aa.vehicle_id, aa.device_id, " +
           "v.registration_no as registration_no, v.vehicle_make, v.vehicle_model, " +
           "d.device_id as device_code, d.device_model, d.device_type, d.mobile_number, " +
           "aa.created_at " +
           "FROM admin_associations aa " +
           "JOIN vehicles v ON v.id = aa.vehicle_id " +
           "JOIN devices d ON d.id = aa.device_id " +
           "ORDER BY aa.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetails();

    // ── For client: vehicles with admin-linked devices, not yet fully associated ─
    // Excludes vehicles that already have a full association (by anyone, including admin with null clientId)
    @Query(value = "SELECT DISTINCT v.id as vehicle_id, v.registration_no as registration_no, " +
               "d.id as device_id, d.device_id as device_code " +
               "FROM vehicles v " +
               "JOIN admin_associations aa ON aa.vehicle_id = v.id " +
               "JOIN devices d ON d.id = aa.device_id " +
               "WHERE (:clientId IS NULL OR v.client_id = :clientId) " +
               "AND v.id NOT IN (SELECT a.vehicle_id FROM associations a)", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithAdminDevice(@Param("clientId") Long clientId);

    // ── Available devices (not linked by admin) ───────────────────────────────
    @Query(value = "SELECT d.id, d.device_id as device_code, d.device_model as device_model, " +
               "d.device_type as device_type, d.mobile_number as mobile_number " +
               "FROM devices d " +
               "WHERE d.id NOT IN (SELECT aa.device_id FROM admin_associations aa)", nativeQuery = true)
    List<Map<String, Object>> findAvailableDevices();

    @Query(value = "SELECT DISTINCT d.id, d.device_id as device_code, d.device_model as device_model, " +
               "d.device_type as device_type, d.mobile_number as mobile_number " +
               "FROM devices d " +
               "WHERE d.created_by = :createdBy " +
               "AND d.id NOT IN (SELECT aa.device_id FROM admin_associations aa) " +
               "ORDER BY d.device_id", nativeQuery = true)
    List<Map<String, Object>> findAvailableDevicesByClientUsername(@Param("createdBy") String createdBy);

    // ── Vehicles dropdown (exclude already-linked vehicles in both tables) ───────────
    @Query(value = "SELECT id, registration_no, vehicle_make, vehicle_model FROM vehicles " +
               "WHERE id NOT IN (SELECT aa.vehicle_id FROM admin_associations aa) " +
               "AND id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "ORDER BY registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesDropdown();

    @Query(value = "SELECT id, registration_no, vehicle_make, vehicle_model FROM vehicles " +
               "WHERE client_id = :clientId " +
               "AND id NOT IN (SELECT aa.vehicle_id FROM admin_associations aa) " +
               "AND id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "ORDER BY registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesDropdownByClientId(@Param("clientId") Long clientId);

    @Query(value = "SELECT aa.id, aa.vehicle_id, aa.device_id, " +
               "v.registration_no as registration_no, v.vehicle_make, v.vehicle_model, " +
               "d.device_id as device_code, d.device_model, d.device_type, d.mobile_number, " +
               "aa.created_at " +
               "FROM admin_associations aa " +
               "JOIN vehicles v ON v.id = aa.vehicle_id " +
               "JOIN devices d ON d.id = aa.device_id " +
               "WHERE v.client_id = :clientId " +
               "ORDER BY aa.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetailsByClientId(@Param("clientId") Long clientId);
}
