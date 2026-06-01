package com.vts.repository;

import com.vts.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    long countByStatus(Boolean status);
    List<Driver> findByClientId(Long clientId);
    long countByClientId(Long clientId);
    long countByClientIdAndStatus(Long clientId, Boolean status);
    Optional<Driver> findByUsername(String username);
    Optional<Driver> findByPhoneNumber(String phoneNumber);
}
