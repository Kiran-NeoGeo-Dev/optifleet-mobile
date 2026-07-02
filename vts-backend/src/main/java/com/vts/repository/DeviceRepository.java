package com.vts.repository;

import com.vts.entity.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {
    Optional<Device> findByDeviceId(String deviceId);
    Optional<Device> findByImeiNumber(String imeiNumber);
    List<Device> findByCreatedBy(String createdBy);
    List<Device> findByClientId(Long clientId);
    List<Device> findByOrgId(Long orgId);
    long countByOrgId(Long orgId);
    long countByOrgIdIsNotNull();
    boolean existsByDeviceId(String deviceId);
    boolean existsByImeiNumber(String imeiNumber);
}
