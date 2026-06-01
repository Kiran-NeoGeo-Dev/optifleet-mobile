package com.vts.repository;

import com.vts.entity.DeviceTbMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface DeviceTbMappingRepository extends JpaRepository<DeviceTbMapping, Long> {

    Optional<DeviceTbMapping> findByDeviceId(String deviceId);
    Optional<DeviceTbMapping> findByImeiNumber(String imeiNumber);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM public.device_tb_mapping WHERE device_id = :deviceId OR imei_number = :imeiNumber",
           nativeQuery = true)
    void deleteByDeviceIdOrImeiNumber(@Param("deviceId") String deviceId,
                                      @Param("imeiNumber") String imeiNumber);

    @Modifying
    @Transactional
    @Query(value = "UPDATE public.device_tb_mapping SET device_id = :newDeviceId, imei_number = :newImeiNumber, updated_at = NOW() WHERE device_id = :oldDeviceId OR imei_number = :oldImeiNumber",
           nativeQuery = true)
    int updateByDeviceIdOrImeiNumber(@Param("oldDeviceId") String oldDeviceId,
                                     @Param("oldImeiNumber") String oldImeiNumber,
                                     @Param("newDeviceId") String newDeviceId,
                                     @Param("newImeiNumber") String newImeiNumber);
}
