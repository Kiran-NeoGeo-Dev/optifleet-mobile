package com.vts.controller;

import com.vts.dto.DeviceRequest;
import com.vts.entity.Device;
import com.vts.entity.DeviceTbMapping;
import com.vts.repository.DeviceTbMappingRepository;
import com.vts.service.DeviceService;
import com.vts.service.ThingsBoardDirectQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private static final Logger log = LoggerFactory.getLogger(DeviceController.class);

    private final DeviceService deviceService;
    private final DeviceTbMappingRepository mappingRepository;
    private final ThingsBoardDirectQueryService tbQuery;

    public DeviceController(DeviceService deviceService,
                           DeviceTbMappingRepository mappingRepository,
                           ThingsBoardDirectQueryService tbQuery) {
        this.deviceService = deviceService;
        this.mappingRepository = mappingRepository;
        this.tbQuery = tbQuery;
    }

    @PreAuthorize("@authService.isAdminRole()")
    @PostMapping
    public ResponseEntity<?> create(@RequestBody DeviceRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(deviceService.createDevice(req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Device>> getAll() {
        return ResponseEntity.ok(deviceService.getAllDevices());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOne(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(deviceService.getDevice(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> count() {
        return ResponseEntity.ok(Map.of("totalDevices", deviceService.getDeviceCount()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody DeviceRequest req) {
        try {
            return ResponseEntity.ok(deviceService.updateDevice(id, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("Device not found"))
                return ResponseEntity.notFound().build();
            return ResponseEntity.status(500).body(Map.of("message", msg != null ? msg : "Update failed"));
        }
    }

    @PreAuthorize("@authService.isAdminRole()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            deviceService.deleteDevice(id);
            return ResponseEntity.ok(Map.of("message", "Device deleted successfully"));
        } catch (RuntimeException e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("Device not found"))
                return ResponseEntity.notFound().build();
            return ResponseEntity.status(500).body(Map.of("message", msg != null ? msg : "Delete failed"));
        }
    }

    @GetMapping("/{id}/battery")
    public ResponseEntity<Map<String, Object>> getBatteryInfo(@PathVariable Long id) {
        try {
            // Get device
            Device device = deviceService.getDevice(id);
            
            // Find ThingsBoard mapping
            Optional<DeviceTbMapping> mappingOpt = mappingRepository.findByDeviceId(device.getDeviceId());
            if (mappingOpt.isEmpty()) {
                mappingOpt = mappingRepository.findByImeiNumber(device.getImeiNumber());
            }
            
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("deviceId", device.getDeviceId());
            
            if (mappingOpt.isEmpty()) {
                log.warn("[DEVICE_BATTERY] No ThingsBoard mapping for device {}", device.getDeviceId());
                result.put("batteryPercentage", null);
                result.put("batteryStatus", null);
                result.put("message", "Device not linked to ThingsBoard");
                return ResponseEntity.ok(result);
            }
            
            String tbDeviceId = mappingOpt.get().getThingsboardDeviceId();
            
            // Fetch battery telemetry from ThingsBoard
            Map<String, Object> battery = tbQuery.fetchDeviceBatteryTelemetry(tbDeviceId);
            
            if (battery != null) {
                result.put("batteryPercentage", battery.get("battery_percentage"));
                result.put("batteryStatus", battery.get("battery_status"));
            } else {
                result.put("batteryPercentage", null);
                result.put("batteryStatus", null);
                result.put("message", "Battery telemetry unavailable");
            }
            
            return ResponseEntity.ok(result);
            
        } catch (RuntimeException e) {
            log.error("[DEVICE_BATTERY] Error fetching battery for device {}: {}", id, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
}
