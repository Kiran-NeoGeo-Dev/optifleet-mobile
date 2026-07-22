package com.vts.controller;

import com.vts.dto.DriverRequest;
import com.vts.entity.Driver;
import com.vts.service.DriverService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @PostMapping
    public ResponseEntity<Driver> createDriver(@Valid @RequestBody DriverRequest request) {
        return ResponseEntity.ok(driverService.createDriver(request));
    }

    @GetMapping
    public ResponseEntity<List<Driver>> listDrivers() {
        return ResponseEntity.ok(driverService.getDriversForCurrentRole());
    }

    /** Returns the profile of the currently logged-in driver (from JWT driverId claim). */
    @GetMapping("/me")
    public ResponseEntity<Driver> getMyProfile() {
        return ResponseEntity.ok(driverService.getDriverFromCurrentToken());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Driver> getDriver(@PathVariable Long id) {
        return ResponseEntity.ok(driverService.getDriver(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Driver> updateDriver(@PathVariable Long id, @Valid @RequestBody DriverRequest request) {
        return ResponseEntity.ok(driverService.updateDriver(id, request));
    }

    @PreAuthorize("@authService.isAdminRole()")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDriver(@PathVariable Long id) {
        driverService.deleteDriver(id);
        return ResponseEntity.noContent().build();
    }
}
