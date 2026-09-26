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

    // ── Get associations with vehicle/device details ───────────────────────────
    @Query(value = "SELECT aa.id, aa.vehicle_id, aa.device_id, " +
               "v.registration_no as registration_no, v.vehicle_make, v.vehicle_model, " +
               "d.device_id as device_code, d.device_model, d.device_type, d.mobile_number, " +
               "aa.created_at, aa.km_travelled " +
               "FROM admin_associations aa " +
               "JOIN vehicles v ON v.id = aa.vehicle_id " +
               "JOIN devices d ON d.id = aa.device_id " +
               "ORDER BY aa.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetails();

    // ── For client: vehicles with admin-linked devices ─────────────────────────
    // excludeAssocId: when editing an existing full-association, allow that vehicle through
    @Query(value = "SELECT DISTINCT v.id as vehicle_id, v.registration_no as registration_no, " +
               "d.id as device_id, d.device_id as device_code " +
               "FROM vehicles v " +
               "JOIN admin_associations aa ON aa.vehicle_id = v.id " +
               "JOIN devices d ON d.id = aa.device_id " +
               "WHERE (:clientId IS NULL OR v.client_id = :clientId) " +
               "AND (v.id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "     OR (:excludeAssocId IS NOT NULL AND v.id IN " +
               "         (SELECT a2.vehicle_id FROM associations a2 WHERE a2.id = :excludeAssocId)))",
               nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithAdminDevice(@Param("clientId") Long clientId,
                                                          @Param("excludeAssocId") Integer excludeAssocId);

    @Query(value = "SELECT DISTINCT v.id AS vehicle_id, v.registration_no, d.id AS device_id, d.device_id AS device_code " +
               "FROM vehicles v JOIN admin_associations aa ON aa.vehicle_id = v.id JOIN devices d ON d.id = aa.device_id " +
               "WHERE v.org_id = :orgId " +
               "AND (v.id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "     OR (:excludeAssocId IS NOT NULL AND v.id IN " +
               "         (SELECT a2.vehicle_id FROM associations a2 WHERE a2.id = :excludeAssocId)))",
               nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithAdminDeviceByOrgId(@Param("orgId") Long orgId,
                                                                  @Param("excludeAssocId") Integer excludeAssocId);

    // ── Available devices (not linked by admin, allow current on edit) ─────────
    @Query(value = "SELECT d.id, d.device_id as device_code, d.device_model as device_model, " +
               "d.device_type as device_type, d.mobile_number as mobile_number " +
               "FROM devices d " +
               "WHERE d.id NOT IN (SELECT aa.device_id FROM admin_associations aa WHERE (:excludeId IS NULL OR aa.id <> :excludeId)) " +
               "AND d.id NOT IN (SELECT a.device_id FROM associations a)",
               nativeQuery = true)
    List<Map<String, Object>> findAvailableDevices(@Param("excludeId") Integer excludeId);

    @Query(value = "SELECT d.id, d.device_id AS device_code, d.device_model, d.device_type, d.mobile_number " +
               "FROM devices d WHERE d.org_id = :orgId " +
               "AND d.id NOT IN (SELECT aa.device_id FROM admin_associations aa WHERE (:excludeId IS NULL OR aa.id <> :excludeId)) " +
               "AND d.id NOT IN (SELECT a.device_id FROM associations a) " +
               "ORDER BY d.device_id", nativeQuery = true)
    List<Map<String, Object>> findAvailableDevicesByOrgId(@Param("orgId") Long orgId, @Param("excludeId") Integer excludeId);

    // ── Vehicles dropdown for Vehicle-Device (admin) form ─────────────────────
    // excludeId: admin_association id being edited — lets that vehicle/device through
    // Also excludes vehicles already in full associations UNLESS we are editing that record
    @Query(value = "SELECT id, registration_no, vehicle_make, vehicle_model FROM vehicles " +
               "WHERE id NOT IN (SELECT aa.vehicle_id FROM admin_associations aa WHERE (:excludeId IS NULL OR aa.id <> :excludeId)) " +
               "AND id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "ORDER BY registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesDropdown(@Param("excludeId") Integer excludeId);

    @Query(value = "SELECT id, registration_no, vehicle_make, vehicle_model FROM vehicles " +
               "WHERE org_id = :orgId " +
               "AND id NOT IN (SELECT aa.vehicle_id FROM admin_associations aa WHERE (:excludeId IS NULL OR aa.id <> :excludeId)) " +
               "AND id NOT IN (SELECT a.vehicle_id FROM associations a) " +
               "ORDER BY registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesDropdownByOrgId(@Param("orgId") Long orgId, @Param("excludeId") Integer excludeId);

    // ── Drivers not yet in associations (allow current driver on edit) ─────────
    @Query(value = "SELECT dr.id as driver_id, dr.driver_name, dr.license_no " +
               "FROM drivers dr " +
               "WHERE dr.org_id = :orgId " +
               "AND dr.id NOT IN (SELECT a.driver_id FROM associations a WHERE (:excludeAssocId IS NULL OR a.id <> :excludeAssocId)) " +
               "ORDER BY dr.driver_name", nativeQuery = true)
    List<Map<String, Object>> findUnassociatedDriversByOrgId(@Param("orgId") Long orgId, @Param("excludeAssocId") Integer excludeAssocId);

    @Query(value = "SELECT dr.id as driver_id, dr.driver_name, dr.license_no " +
               "FROM drivers dr " +
               "WHERE dr.id NOT IN (SELECT a.driver_id FROM associations a WHERE (:excludeAssocId IS NULL OR a.id <> :excludeAssocId)) " +
               "ORDER BY dr.driver_name", nativeQuery = true)
    List<Map<String, Object>> findUnassociatedDriversAll(@Param("excludeAssocId") Integer excludeAssocId);

    @Query(value = "SELECT aa.id, aa.vehicle_id, aa.device_id, " +
               "v.registration_no as registration_no, v.vehicle_make, v.vehicle_model, " +
               "d.device_id as device_code, d.device_model, d.device_type, d.mobile_number, " +
               "aa.created_at, aa.km_travelled " +
               "FROM admin_associations aa " +
               "JOIN vehicles v ON v.id = aa.vehicle_id " +
               "JOIN devices d ON d.id = aa.device_id " +
               "WHERE v.client_id = :clientId " +
               "ORDER BY aa.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetailsByClientId(@Param("clientId") Long clientId);

    @Query(value = "SELECT aa.id, aa.vehicle_id, aa.device_id, v.registration_no, v.vehicle_make, v.vehicle_model, " +
               "d.device_id AS device_code, d.device_model, d.device_type, d.mobile_number, aa.created_at, aa.km_travelled " +
               "FROM admin_associations aa JOIN vehicles v ON v.id = aa.vehicle_id JOIN devices d ON d.id = aa.device_id " +
               "WHERE v.org_id = :orgId ORDER BY aa.created_at DESC", nativeQuery = true)
    List<Map<String, Object>> findAllWithDetailsByOrgId(@Param("orgId") Long orgId);
}
