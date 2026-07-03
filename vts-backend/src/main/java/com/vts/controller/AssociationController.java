package com.vts.controller;

import com.vts.entity.Association;
import com.vts.entity.DeviceDriver;
import com.vts.service.AssociationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/associations")
public class AssociationController {

    private final AssociationService service;

    public AssociationController(AssociationService service) {
        this.service = service;
    }

    // ── Dropdowns ──────────────────────────────────────────────────────────────

    @GetMapping("/vehicles-with-device")
    public ResponseEntity<List<Map<String, Object>>> vehiclesWithDevice() {
        return ResponseEntity.ok(service.getVehiclesWithDevice());
    }

    @GetMapping("/vehicles-for-trip")
    public ResponseEntity<List<Map<String, Object>>> vehiclesForTrip() {
        return ResponseEntity.ok(service.getVehiclesWithDriverForTrip());
    }

    @GetMapping("/drivers-by-device")
    public ResponseEntity<List<Map<String, Object>>> driversByDevice(@RequestParam(required = false) Integer deviceId) {
        return ResponseEntity.ok(service.getDriversByDevice(deviceId));
    }

    @GetMapping("/device-drivers")
    public ResponseEntity<List<DeviceDriver>> deviceDrivers() {
        return ResponseEntity.ok(service.getAllDeviceDrivers());
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicleId"));
            if (body.containsKey("deviceDriverId")) {
                return ResponseEntity.ok(service.createAssociation(vehicleId, toInt(body.get("deviceDriverId"))));
            }
            Integer deviceId = toInt(body.get("deviceId"));
            Integer driverId = toInt(body.get("driverId"));
            String  country  = body.get("country") != null ? body.get("country").toString() : "India";
            Boolean status   = toBool(body.get("status"));
            return ResponseEntity.ok(service.createAssociation(vehicleId, deviceId, driverId, country, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAll() {
        return ResponseEntity.ok(service.getAllAssociationsWithDetails());
    }

    @GetMapping("/all")
    public ResponseEntity<List<Association>> getAllRaw() {
        return ResponseEntity.ok(service.getAllAssociations());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOne(@PathVariable Integer id) {
        return service.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        try {
            Integer vehicleId = toInt(body.get("vehicleId"));
            Integer deviceId  = toInt(body.get("deviceId"));
            Integer driverId  = toInt(body.get("driverId"));
            String  country   = body.get("country") != null ? body.get("country").toString() : "India";
            Boolean status    = toBool(body.get("status"));
            return ResponseEntity.ok(service.updateAssociation(id, vehicleId, deviceId, driverId, country, status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            service.deleteAssociation(id);
            return ResponseEntity.ok(Map.of("message", "Association deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private Integer toInt(Object val) {
        if (val == null) return null;
        if (val instanceof Integer) return (Integer) val;
        if (val instanceof Number)  return ((Number) val).intValue();
        return Integer.parseInt(val.toString());
    }

    private Boolean toBool(Object val) {
        if (val == null) return true;
        if (val instanceof Boolean) return (Boolean) val;
        return Boolean.parseBoolean(val.toString());
    }
}
