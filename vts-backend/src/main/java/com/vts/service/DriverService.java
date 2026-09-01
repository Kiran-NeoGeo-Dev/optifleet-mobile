package com.vts.service;

import com.vts.dto.DriverRequest;
import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.ClientRepository;
import com.vts.repository.DriverRepository;
import com.vts.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(DriverService.class);

    private final DriverRepository  driverRepository;
    private final AuthService       authService;
    private final JwtService        jwtService;
    private final ClientRepository  clientRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public DriverService(DriverRepository driverRepository, AuthService authService,
                         JwtService jwtService, ClientRepository clientRepository,
                         org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.driverRepository = driverRepository;
        this.authService      = authService;
        this.jwtService       = jwtService;
        this.clientRepository = clientRepository;
        this.passwordEncoder  = passwordEncoder;
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

    /**
     * Normalize Indian phone number to 10-digit format.
     * Handles:
     * - "+919876543210" → "9876543210"
     * - "919876543210" → "9876543210"
     * - "9876543210" → "9876543210"
     * 
     * This ensures the username field is always in a consistent format for OTP lookup.
     */
    private String normalizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return null;
        }
        String cleaned = phoneNumber.trim();
        // Remove +91 prefix if present
        cleaned = cleaned.replaceAll("^\\+91", "");
        // Remove 91 prefix if present (and number length would be correct after removal)
        if (cleaned.startsWith("91") && cleaned.length() == 12) {
            cleaned = cleaned.substring(2);
        }
        // Return the 10-digit number
        return cleaned;
    }

    public Driver createDriver(DriverRequest request) {
        Driver driver = new Driver();
        mapRequestToDriver(request, driver);
        Long ownerId = authService.resolveResourceOwner(request.getClientId());
        driver.setClientId(ownerId);
        driver.setOrgId(resolveOrgId(ownerId));
        // FIX BUG-019: Normalize phone number to 10-digit format before setting username
        // username = mobile number (10-digit), password = date of birth (DD/MM/YYYY) stored as plain text per requirement
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());
            driver.setUsername(normalizedPhone);
            log.info("[DriverService] Created driver with normalized username: {} (original: {})", normalizedPhone, request.getPhoneNumber());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            driver.setPassword(request.getPassword().trim());
        }
        driver.setCreatedAt(LocalDateTime.now());
        driver.setUpdatedAt(LocalDateTime.now());
        return driverRepository.save(driver);
    }

    private Long resolveOrgId(Long clientId) {
        if (clientId == null) return null;
        return clientRepository.findById(clientId)
                .map(Client::getOrgId)
                .orElse(null);
    }

    public List<Driver> getDriversForCurrentRole() {
        Client client = authService.getCurrentClient();
        if (client == null) return List.of();
        if (authService.isSuperAdmin(client)) return driverRepository.findAll();
        if (authService.isAdmin(client)) return driverRepository.findByOrgId(client.getOrgId());
        return driverRepository.findByClientId(client.getId());
    }

    public List<Driver> getAllDrivers() {
        return getDriversForCurrentRole();
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
        } catch (Exception e) {
            log.warn("[DriverService] Could not resolve driverId from token: {}", e.getMessage());
        }
        throw new ResourceNotFoundException("Driver profile not found");
    }

    public Driver getDriver(Long driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));
        authService.requireOrgAccess(driver.getOrgId(), driver.getClientId());
        return driver;
    }

    public Driver updateDriver(Long driverId, DriverRequest request) {
        Driver driver = getDriver(driverId);
        mapRequestToDriver(request, driver);
        if (request.getClientId() != null) {
            Long ownerId = authService.resolveResourceOwner(request.getClientId());
            driver.setClientId(ownerId);
            driver.setOrgId(resolveOrgId(ownerId));
        }
        // FIX BUG-019: Keep username in sync with phone number using normalized format
        // password = date of birth (DD/MM/YYYY) stored as plain text per requirement
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());
            driver.setUsername(normalizedPhone);
            log.info("[DriverService] Updated driver username to normalized format: {} (original: {})", normalizedPhone, request.getPhoneNumber());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            driver.setPassword(request.getPassword().trim());
        }
        driver.setUpdatedAt(LocalDateTime.now());
        return driverRepository.save(driver);
    }

    public void deleteDriver(Long driverId) {
        driverRepository.delete(getDriver(driverId));
    }

    private void mapRequestToDriver(DriverRequest request, Driver driver) {
        driver.setDriverName(truncate(request.getDriverName(), 50));
        driver.setPhoneNumber(truncate(request.getPhoneNumber(), 15));
        if (request.getLicenseNumber() != null) driver.setLicenseNumber(truncate(request.getLicenseNumber(), 20));
        LocalDate expiry = parseDate(request.getLicenseExpiry());
        if (expiry != null) {
            // FIX BUG-012: Validate license expiry date
            if (expiry.isBefore(LocalDate.now())) {
                throw new IllegalArgumentException("Driver license has expired. Please provide a valid license.");
            }
            driver.setLicenseExpiry(expiry);
        }
        if (request.getAadharNumber() != null) driver.setAadharNumber(truncate(request.getAadharNumber(), 12));
        driver.setStatus(parseStatus(request.getStatus()));
        driver.setComments(request.getComments() != null ? request.getComments() : driver.getComments());
        if (request.getFrontFaceImage() != null) driver.setFrontFaceImage(request.getFrontFaceImage());
        if (request.getLeftFaceImage()  != null) driver.setLeftFaceImage(request.getLeftFaceImage());
        if (request.getRightFaceImage() != null) driver.setRightFaceImage(request.getRightFaceImage());
    }
}
