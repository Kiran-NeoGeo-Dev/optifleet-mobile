package com.vts.repository;

import com.vts.entity.DeviceDriver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface DeviceDriverRepository extends JpaRepository<DeviceDriver, Integer> {
    Optional<DeviceDriver> findByDriverId(Integer driverId);
    void deleteByDriverId(Integer driverId);

    @Query(value =
        "SELECT dr.id AS driver_id, dr.driver_name, dr.license_no " +
        "FROM drivers dr " +
        "WHERE dr.client_id = :clientId " +
        "AND dr.status = true " +
        "ORDER BY dr.driver_name", nativeQuery = true)
    List<Map<String, Object>> findDriversByClientId(@Param("clientId") Long clientId);

    @Query(value = 
        "SELECT dr.id AS driver_id, dr.driver_name, dr.license_no " +
        "FROM device_drivers dd " +
        "JOIN drivers dr ON dr.id = dd.driver_id " +
        "WHERE dd.device_id = :deviceId " +
        "ORDER BY dr.driver_name", nativeQuery = true)
    List<Map<String, Object>> findDriversByDeviceId(@Param("deviceId") Integer deviceId);

    // Backward compatibility - get all drivers for a device (used by admin)
    @Query(value = 
        "SELECT dr.id AS driver_id, dr.driver_name, dr.license_no " +
        "FROM device_drivers dd " +
        "JOIN drivers dr ON dr.id = dd.driver_id " +
        "WHERE dd.device_id = :deviceId " +
        "ORDER BY dr.driver_name", nativeQuery = true)
    List<Map<String, Object>> findDriversByDeviceIdAllClients(@Param("deviceId") Integer deviceId);

    @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM DeviceDriver d WHERE d.deviceId = :deviceId AND d.driverId = :driverId")
    boolean existsByDeviceIdAndDriverId(@Param("deviceId") Integer deviceId, @Param("driverId") Integer driverId);
}
