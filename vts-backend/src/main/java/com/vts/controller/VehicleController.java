package com.vts.controller;

import com.vts.dto.VehicleRequest;
import com.vts.entity.Vehicle;
import com.vts.service.VehicleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @PostMapping
    public ResponseEntity<?> createVehicle(@Valid @RequestBody VehicleRequest request) {
        try {
            return ResponseEntity.ok(vehicleService.createVehicle(request));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            String msg = e.getRootCause() != null ? e.getRootCause().getMessage() : e.getMessage();
            if (msg != null && msg.contains("registration_no"))  return ResponseEntity.badRequest().body(java.util.Map.of("message", "Vehicle registration number already exists."));
            if (msg != null && msg.contains("chassis_number"))   return ResponseEntity.badRequest().body(java.util.Map.of("message", "Chassis number already exists."));
            if (msg != null && msg.contains("engine_number"))    return ResponseEntity.badRequest().body(java.util.Map.of("message", "Engine number already exists."));
            if (msg != null && msg.contains("insurance_number")) return ResponseEntity.badRequest().body(java.util.Map.of("message", "Insurance number already exists."));
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "Duplicate value: " + msg));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Vehicle>> listVehicles() {
        return ResponseEntity.ok(vehicleService.getVehiclesForCurrentRole());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Vehicle> getVehicle(@PathVariable Long id) {
        return ResponseEntity.ok(vehicleService.getVehicle(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vehicle> updateVehicle(@PathVariable Long id, @Valid @RequestBody VehicleRequest request) {
        return ResponseEntity.ok(vehicleService.updateVehicle(id, request));
    }
}
