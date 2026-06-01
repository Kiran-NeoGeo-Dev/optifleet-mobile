package com.vts.controller;

import com.vts.dto.DeviceRequest;
import com.vts.entity.Device;
import com.vts.service.DeviceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

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
}
