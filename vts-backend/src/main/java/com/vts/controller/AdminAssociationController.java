package com.vts.controller;

import com.vts.entity.AdminAssociation;
import com.vts.entity.Association;
import com.vts.service.AdminAssociationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin-associations")
@PreAuthorize("@authService.isAdminRole()")
public class AdminAssociationController {

    private final AdminAssociationService service;

    public AdminAssociationController(AdminAssociationService service) {
        this.service = service;
    }

    // -- Dropdowns --
    @GetMapping("/vehicles")
    public ResponseEntity<List<Map<String, Object>>> vehiclesDropdown(
            @RequestParam(required = false) Integer excludeId) {
        return ResponseEntity.ok(service.getVehiclesDropdown(excludeId));
    }

    @GetMapping("/available-devices")
    public ResponseEntity<List<Map<String, Object>>> availableDevices(
            @RequestParam(required = false) Integer excludeId) {
        return ResponseEntity.ok(service.getAvailableDevices(excludeId));
    }

    @GetMapping("/vehicles-with-device")
    public ResponseEntity<List<Map<String, Object>>> vehiclesWithDevice(
            @RequestParam(required = false) Integer excludeAssocId) {
        return ResponseEntity.ok(service.getVehiclesWithDevice(excludeAssocId));
    }

    @GetMapping("/all-drivers")
    public ResponseEntity<List<Map<String, Object>>> allDrivers(
            @RequestParam(required = false) Integer excludeAssocId) {
        return ResponseEntity.ok(service.getUnassociatedDrivers(excludeAssocId));
    }

    // -- Full (Vehicle-Device-Driver) Associations --
    @PostMapping("/full")
    public ResponseEntity<?> createFull(@RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicleId"));
            Integer deviceId  = toInt(body.get("deviceId"));
            Integer driverId  = toInt(body.get("driverId"));
            String  country   = body.get("country") != null ? body.get("country").toString() : "India";
            Boolean status    = body.get("status") instanceof Boolean ? (Boolean) body.get("status") : true;
            if (vehicleId == null || deviceId == null || driverId == null)
                return ResponseEntity.badRequest().body(Map.of("message", "vehicleId, deviceId and driverId are required"));
            return ResponseEntity.status(HttpStatus.CREATED).body(service.createFullAssociation(vehicleId, deviceId, driverId, country, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/full")
    public ResponseEntity<List<Map<String, Object>>> getAllFull() {
        return ResponseEntity.ok(service.getAllFullAssociations());
    }

    @PutMapping("/full/{id}")
    public ResponseEntity<?> updateFull(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicleId"));
            Integer deviceId  = toInt(body.get("deviceId"));
            Integer driverId  = toInt(body.get("driverId"));
            String  country   = body.get("country") != null ? body.get("country").toString() : "India";
            Boolean status    = body.get("status") instanceof Boolean ? (Boolean) body.get("status") : true;
            return ResponseEntity.ok(service.updateFullAssociation(id, vehicleId, deviceId, driverId, country, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/full/{id}")
    public ResponseEntity<?> deleteFull(@PathVariable Integer id) {
        try {
            service.deleteFullAssociation(id);
            return ResponseEntity.ok(Map.of("message", "Association deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // -- CRUD --
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicle_id"));
            Integer deviceId = toInt(body.get("device_id"));
            if (vehicleId == null || deviceId == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "vehicle_id and device_id are required"));
            }
            AdminAssociation result = service.create(vehicleId, deviceId);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAll() {
        return ResponseEntity.ok(service.getAllWithDetails());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOne(@PathVariable Integer id) {
        return service.getAllWithDetails().stream()
            .filter(map -> id.equals(map.get("id")))
            .findFirst()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicle_id"));
            Integer deviceId = toInt(body.get("device_id"));
            AdminAssociation result = service.update(id, vehicleId, deviceId);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            service.delete(id);
            return ResponseEntity.ok(Map.of("message", "Admin association deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/count")
    public ResponseEntity<Integer> getCount() {
        return ResponseEntity.ok(service.getAllWithDetails().size());
    }

    private Integer toInt(Object val) {
        if (val == null) return null;
        if (val instanceof Integer) return (Integer) val;
        if (val instanceof Number) return ((Number) val).intValue();
        return Integer.parseInt(val.toString());
    }
}
