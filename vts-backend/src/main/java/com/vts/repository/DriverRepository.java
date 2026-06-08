package com.vts.repository;

import com.vts.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    long countByStatus(Boolean status);
    List<Driver> findByClientId(Long clientId);
    long countByClientId(Long clientId);
    long countByClientIdAndStatus(Long clientId, Boolean status);
    Optional<Driver> findByUsername(String username);
    Optional<Driver> findByPhoneNumber(String phoneNumber);

    // Returns drivers not yet present in associations for this client
    @Query(value =
        "SELECT * FROM drivers " +
        "WHERE client_id = :clientId " +
        "AND status = true " +
        "AND id NOT IN (SELECT driver_id FROM associations WHERE client_id = :clientId) " +
        "ORDER BY driver_name", nativeQuery = true)
    List<Driver> findAvailableByClientId(@Param("clientId") Long clientId);
}
