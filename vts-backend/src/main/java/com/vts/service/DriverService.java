package com.vts.service;

import com.vts.dto.DriverRequest;
import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.DriverRepository;
import com.vts.security.JwtService;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final AuthService      authService;
    private final JwtService       jwtService;

    public DriverService(DriverRepository driverRepository, AuthService authService,
                         JwtService jwtService) {
        this.driverRepository = driverRepository;
        this.authService      = authService;
        this.jwtService       = jwtService;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isEmpty()) return null;
        if (value.length() > 10) return Instant.parse(value).atZone(java.time.ZoneOffset.UTC).toLocalDate();
        return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private Boolean parseStatus(String status) {
        if (status == null) return true;
        return "ACTIVE".equalsIgnoreCase(status);
    }

    private String truncate(String value, int maxLen) {
        if (value == null) return null;
        return value.length() > maxLen ? value.substring(0, maxLen) : value;
    }

    public Driver createDriver(DriverRequest request) {
        Client client = authService.getCurrentClient();
        Driver driver = new Driver();
        mapRequestToDriver(request, driver);
        if (request.getClientId() != null) {
            driver.setClientId(request.getClientId());
        } else if (client != null) {
            driver.setClientId(client.getId());
        }
        // Auto-set username = phone number for OTP-based login
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            driver.setUsername(request.getPhoneNumber().trim());
        }
        driver.setPassword(null);
        driver.setCreatedAt(LocalDateTime.now());
        driver.setUpdatedAt(LocalDateTime.now());
        return driverRepository.save(driver);
    }

    public List<Driver> getDriversForCurrentRole() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if ("Admin".equalsIgnoreCase(client.getRole())) return driverRepository.findAll();
        return driverRepository.findByClientId(client.getId());
    }

    public List<Driver> getAllDrivers() {
        return driverRepository.findAll();
    }

    public List<Driver> getDriversForCurrentClient() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        return driverRepository.findByClientId(client.getId());
    }

    public Driver getDriverFromCurrentToken() {
        try {
            var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            String authHeader = attrs.getRequest().getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                Object driverIdObj = jwtService.extractAllClaims(token).get("driverId");
                if (driverIdObj != null) {
                    Long driverId = Long.parseLong(driverIdObj.toString());
                    return getDriver(driverId);
                }
            }
        } catch (Exception ignored) {}
        throw new ResourceNotFoundException("Driver profile not found");
    }

    public Driver getDriver(Long driverId) {
        return driverRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
    }

    public Driver updateDriver(Long driverId, DriverRequest request) {
        Driver driver = getDriver(driverId);
        mapRequestToDriver(request, driver);
        if (request.getClientId() != null) {
            driver.setClientId(request.getClientId());
        }
        // Keep username in sync with phone number
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            driver.setUsername(request.getPhoneNumber().trim());
        }
        driver.setUpdatedAt(LocalDateTime.now());
        return driverRepository.save(driver);
    }

    public void deleteDriver(Long driverId) {
        if (!driverRepository.existsById(driverId))
            throw new ResourceNotFoundException("Driver not found");
        driverRepository.deleteById(driverId);
    }

    private void mapRequestToDriver(DriverRequest request, Driver driver) {
        driver.setDriverName(truncate(request.getDriverName(), 50));
        driver.setPhoneNumber(truncate(request.getPhoneNumber(), 15));
        if (request.getLicenseNumber() != null) driver.setLicenseNumber(truncate(request.getLicenseNumber(), 20));
        LocalDate expiry = parseDate(request.getLicenseExpiry());
        if (expiry != null) driver.setLicenseExpiry(expiry);
        if (request.getAadharNumber() != null) driver.setAadharNumber(truncate(request.getAadharNumber(), 12));
        driver.setStatus(parseStatus(request.getStatus()));
        driver.setComments(request.getComments() != null ? request.getComments() : driver.getComments());
        if (request.getFrontFaceImage() != null) driver.setFrontFaceImage(request.getFrontFaceImage());
        if (request.getLeftFaceImage()  != null) driver.setLeftFaceImage(request.getLeftFaceImage());
        if (request.getRightFaceImage() != null) driver.setRightFaceImage(request.getRightFaceImage());
    }
}
