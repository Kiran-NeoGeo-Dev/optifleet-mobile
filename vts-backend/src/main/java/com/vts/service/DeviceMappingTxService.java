package com.vts.service;

import com.vts.entity.DeviceTbMapping;
import com.vts.repository.DeviceTbMappingRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class DeviceMappingTxService {

    private static final Logger log = LoggerFactory.getLogger(DeviceMappingTxService.class);

    @PersistenceContext
    private EntityManager em;

    private final DeviceTbMappingRepository mappingRepository;

    public DeviceMappingTxService(DeviceTbMappingRepository mappingRepository) {
        this.mappingRepository = mappingRepository;
    }

    /** Read by device_id in its own transaction — plain JPQL select, no cache issues. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<DeviceTbMapping> findByDeviceId(String deviceId) {
        return mappingRepository.findByDeviceId(deviceId);
    }

    /** Read by imei_number in its own transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<DeviceTbMapping> findByImeiNumber(String imeiNumber) {
        return mappingRepository.findByImeiNumber(imeiNumber);
    }

    /**
     * UPDATE via raw native SQL in its own transaction.
     * Bypasses Hibernate entity cache — hits PostgreSQL directly.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int updateMapping(String oldDeviceId, String oldImeiNumber,
                             String newDeviceId, String newImeiNumber) {
        int rows = em.createNativeQuery(
                "UPDATE public.device_tb_mapping " +
                "SET device_id = :newDeviceId, imei_number = :newImeiNumber, updated_at = NOW() " +
                "WHERE device_id = :oldDeviceId OR imei_number = :oldImeiNumber")
                .setParameter("newDeviceId", newDeviceId)
                .setParameter("newImeiNumber", newImeiNumber)
                .setParameter("oldDeviceId", oldDeviceId)
                .setParameter("oldImeiNumber", oldImeiNumber)
                .executeUpdate();
        log.info("Mapping UPDATE: {} → {} / {} → {} rows={}", oldDeviceId, newDeviceId, oldImeiNumber, newImeiNumber, rows);
        return rows;
    }

    /**
     * DELETE via raw native SQL in its own transaction.
     * Bypasses Hibernate entity cache — hits PostgreSQL directly.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteMapping(String deviceId, String imeiNumber) {
        int rows = em.createNativeQuery(
                "DELETE FROM public.device_tb_mapping " +
                "WHERE device_id = :deviceId OR imei_number = :imeiNumber")
                .setParameter("deviceId", deviceId)
                .setParameter("imeiNumber", imeiNumber)
                .executeUpdate();
        log.info("Mapping DELETE: deviceId={} imei={} rows={}", deviceId, imeiNumber, rows);
    }

    /** Save (insert or update) a Device in its own committed transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public com.vts.entity.Device saveDevice(com.vts.entity.Device device) {
        com.vts.entity.Device saved = em.merge(device);
        em.flush();
        return saved;
    }

    /** Delete a Device by id in its own committed transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteDevice(Long id) {
        em.createNativeQuery("DELETE FROM public.devices WHERE id = :id")
                .setParameter("id", id)
                .executeUpdate();
        log.info("Device DELETE: id={}", id);
    }
}
