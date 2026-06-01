package com.vts.controller;

import com.vts.entity.Driver;
import com.vts.service.DriverService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/driver-photos")
public class DriverPhotoController {

    private final DriverService driverService;

    public DriverPhotoController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping("/{driverId}")
    public ResponseEntity<Map<String, String>> getDriverPhotos(@PathVariable Long driverId) {
        Driver driver = driverService.getDriver(driverId);
        Map<String, String> photos = new HashMap<>();
        photos.put("frontFaceImage", driver.getFrontFaceImage());
        photos.put("leftFaceImage",  driver.getLeftFaceImage());
        photos.put("rightFaceImage", driver.getRightFaceImage());
        return ResponseEntity.ok(photos);
    }
}
