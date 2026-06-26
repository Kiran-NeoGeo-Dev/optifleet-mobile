package com.vts.repository;

import com.vts.entity.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    List<Vehicle> findByClientId(Long clientId);
    List<Vehicle> findByOrgId(Long orgId);
    long countByOrgId(Long orgId);
    long countByClientId(Long clientId);
    Optional<Vehicle> findByLicensePlate(String licensePlate);

@Query(value =
        "SELECT v.id AS vehicle_id, v.registration_no, " +
        "d.id AS device_id, d.device_id AS device_code " +
        "FROM vehicles v " +
        "JOIN admin_associations aa ON aa.vehicle_id = v.id " +
        "JOIN devices d ON d.id = aa.device_id " +
        "ORDER BY v.registration_no", nativeQuery = true)
    List<Map<String, Object>> findVehiclesWithDevice();

    @Query("SELECT CASE WHEN COUNT(v) > 0 THEN true ELSE false END FROM Vehicle v WHERE v.id = :id AND v.deviceId = :deviceId")
    boolean existsByIdAndDeviceId(@Param("id") Long id, @Param("deviceId") Integer deviceId);
}
