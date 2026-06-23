package com.vts.service;

import com.vts.dto.DeviceRequest;
import com.vts.entity.Client;
import com.vts.entity.Device;
import com.vts.entity.DeviceTbMapping;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DeviceTbMappingRepository;
import com.vts.utils.FernetEncryptionUtil;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

@Service
public class DeviceService {

    private static final Logger log = LoggerFactory.getLogger(DeviceService.class);

    private final DeviceRepository          deviceRepository;
    private final AuthService               authService;
    private final DeviceTbMappingRepository mappingRepository;
    private final DeviceMappingTxService    mappingTx;
    private final ThingsBoardDeviceService  tbDeviceService;
    private final FernetEncryptionUtil      encryption;

    public DeviceService(DeviceRepository deviceRepository,
                         AuthService authService,
                         DeviceTbMappingRepository mappingRepository,
                         DeviceMappingTxService mappingTx,
                         ThingsBoardDeviceService tbDeviceService,
                         FernetEncryptionUtil encryption) {
        this.deviceRepository  = deviceRepository;
        this.authService       = authService;
        this.mappingRepository = mappingRepository;
        this.mappingTx         = mappingTx;
        this.tbDeviceService   = tbDeviceService;
        this.encryption        = encryption;
    }

    // ── Startup: re-encrypt any plain-text tokens left in the DB ─────────────

    @PostConstruct
    @Transactional
    public void migrateExistingTokens() {
        List<DeviceTbMapping> all = mappingRepository.findAll();
        int migrated = 0;
        for (DeviceTbMapping m : all) {
            String stored = m.getTbAccessToken();
            if (stored == null || stored.isBlank()) continue;
            if (!isEncrypted(stored)) {
                m.setTbAccessToken(encryption.encrypt(stored));
                mappingRepository.save(m);
                migrated++;
                log.info("Migrated plain-text token to encrypted for deviceId={}", m.getDeviceId());
            }
        }
        if (migrated > 0) log.info("Token migration complete: {} token(s) encrypted", migrated);
    }

    private boolean isEncrypted(String value) {
        // Fernet tokens are Base64-URL encoded and always start with 'g' (0x80 version byte)
        return value != null && value.startsWith("g") && value.length() > 56;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public Device createDevice(DeviceRequest req) {
        validate(req);
        if (deviceRepository.existsByDeviceId(req.getDeviceId()))
            throw new IllegalArgumentException("Device ID already exists");
        if (deviceRepository.existsByImeiNumber(req.getImeiNumber()))
            throw new IllegalArgumentException("IMEI number already exists");

        Device device = new Device();
        mapFields(device, req);
        Client client = authService.getCurrentClient();
        if (req.getClientId() != null) {
            device.setCreatedBy("client_" + req.getClientId());
            device.setClientId(req.getClientId());
        } else if (client != null && !"Admin".equalsIgnoreCase(client.getRole())) {
            device.setCreatedBy(client.getUsername());
            device.setClientId(client.getId());
        }
        Device saved = deviceRepository.save(device);
        log.info("Device saved locally: deviceId={}", saved.getDeviceId());

        // TB sync runs after local save — non-blocking
        try {
            String tbDeviceId = tbDeviceService.createDevice(req.getDeviceId());
            String rawToken   = tbDeviceService.getAccessToken(tbDeviceId);
            String encToken   = encryption.encrypt(rawToken);

            DeviceTbMapping mapping = new DeviceTbMapping();
            mapping.setDeviceId(saved.getDeviceId());
            mapping.setImeiNumber(saved.getImeiNumber());
            mapping.setThingsboardDeviceId(tbDeviceId);
            mapping.setTbAccessToken(encToken);
            mapping.setAdminId(resolveAdminId(req, client));
            if (req.getClientId() != null)
                mapping.setAssociatedUserId(req.getClientId().intValue());

            mappingRepository.save(mapping);
            log.info("TB mapping saved: deviceId={} tbDeviceId={}", saved.getDeviceId(), tbDeviceId);
        } catch (Exception e) {
            log.error("ThingsBoard sync failed for deviceId={} (device still saved locally): {}",
                    saved.getDeviceId(), e.getMessage());
        }

        return saved;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public List<Device> getAllDevices() {
        Client client = authService.getCurrentClient();
        if (client != null && !"Admin".equalsIgnoreCase(client.getRole()))
            return deviceRepository.findByClientId(client.getId());
        return deviceRepository.findAll();
    }

    public Device getDevice(Long id) {
        return deviceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Device not found"));
    }

    public long getDeviceCount() {
        return deviceRepository.count();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public Device updateDevice(Long id, DeviceRequest req) {
        validate(req);
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        // Capture originals BEFORE any changes
        String originalDeviceId = device.getDeviceId();
        String originalImei     = device.getImeiNumber();

        deviceRepository.findByDeviceId(req.getDeviceId()).ifPresent(existing -> {
            if (!existing.getId().equals(id))
                throw new IllegalArgumentException("Device ID already exists");
        });
        deviceRepository.findByImeiNumber(req.getImeiNumber()).ifPresent(existing -> {
            if (!existing.getId().equals(id))
                throw new IllegalArgumentException("IMEI number already exists");
        });

        // Step 1: find mapping BEFORE updating device (uses original keys)
        Optional<DeviceTbMapping> mappingOpt = mappingRepository.findByDeviceId(originalDeviceId);
        if (mappingOpt.isEmpty())
            mappingOpt = mappingRepository.findByImeiNumber(originalImei);
        String tbDeviceId = mappingOpt.map(DeviceTbMapping::getThingsboardDeviceId).orElse(null);

        // Step 2: update device in DB
        mapFields(device, req);
        if (req.getClientId() != null) {
            device.setClientId(req.getClientId());
            device.setCreatedBy("client_" + req.getClientId());
        }
        Device updated = mappingTx.saveDevice(device);
        log.info("Device updated locally: deviceId={}", updated.getDeviceId());

        // Step 3: update mapping table (now device is committed)
        if (tbDeviceId != null) {
            try {
                int rows = mappingTx.updateMapping(
                        originalDeviceId, originalImei,
                        updated.getDeviceId(), updated.getImeiNumber());
                log.info("Mapping updated: rows={}", rows);
            } catch (Exception e) {
                log.error("Mapping update failed for deviceId={}: {}", updated.getDeviceId(), e.getMessage());
            }
        }

        // Step 4: update ThingsBoard device name (non-blocking)
        if (tbDeviceId != null) {
            try {
                tbDeviceService.updateDevice(tbDeviceId, updated.getDeviceId());
                log.info("TB device updated: tbDeviceId={} newName={}", tbDeviceId, updated.getDeviceId());
            } catch (Exception e) {
                log.error("ThingsBoard update failed for deviceId={}: {}", updated.getDeviceId(), e.getMessage());
            }
        } else {
            log.warn("No TB mapping found for deviceId={} imei={} — skipping TB update",
                    originalDeviceId, originalImei);
        }

        return updated;
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void deleteDevice(Long id) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        String deviceIdToDelete = device.getDeviceId();
        String imeiToDelete     = device.getImeiNumber();

        // Step 1: find mapping BEFORE deleting anything
        Optional<DeviceTbMapping> mappingOpt = mappingRepository.findByDeviceId(deviceIdToDelete);
        if (mappingOpt.isEmpty())
            mappingOpt = mappingRepository.findByImeiNumber(imeiToDelete);
        String tbDeviceId = mappingOpt.map(DeviceTbMapping::getThingsboardDeviceId).orElse(null);

        // Step 2: delete mapping first (no FK constraint to devices table)
        mappingTx.deleteMapping(deviceIdToDelete, imeiToDelete);
        log.info("Mapping deleted for deviceId={}", deviceIdToDelete);

        // Step 3: delete local device
        mappingTx.deleteDevice(id);
        log.info("Device deleted locally: deviceId={}", deviceIdToDelete);

        // Step 4: delete from ThingsBoard (non-blocking)
        if (tbDeviceId != null) {
            try {
                tbDeviceService.deleteDevice(tbDeviceId);
                log.info("TB device deleted: tbDeviceId={}", tbDeviceId);
            } catch (Exception e) {
                log.error("TB delete failed (device already removed locally): {}", e.getMessage());
            }
        } else {
            log.warn("No TB mapping found for deviceId={} imei={}", deviceIdToDelete, imeiToDelete);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validate(DeviceRequest req) {
        if (req.getDeviceId() == null || req.getDeviceId().isBlank())
            throw new IllegalArgumentException("Device ID is required");
        if (req.getMobileNumber() == null || !req.getMobileNumber().matches("\\d{10}"))
            throw new IllegalArgumentException("Mobile number must be exactly 10 digits");
        if (req.getImeiNumber() == null || !req.getImeiNumber().matches("\\d{15}"))
            throw new IllegalArgumentException("IMEI number must be exactly 15 digits");
        if (req.getDeviceModel() == null || req.getDeviceModel().isBlank())
            throw new IllegalArgumentException("Device model is required");
    }

    private void mapFields(Device device, DeviceRequest req) {
        device.setDeviceId(req.getDeviceId());
        device.setDeviceType(req.getDeviceType() != null ? req.getDeviceType() : "MOBILE");
        device.setMobileNumber(req.getMobileNumber());
        device.setImeiNumber(req.getImeiNumber());
        device.setDeviceModel(req.getDeviceModel());
        device.setStatus(Boolean.TRUE.equals(req.getStatus()));
    }

    private Integer resolveAdminId(DeviceRequest req, Client client) {
        if (client != null) return client.getId().intValue();
        if (req.getClientId() != null) return req.getClientId().intValue();
        return 1;
    }
}
