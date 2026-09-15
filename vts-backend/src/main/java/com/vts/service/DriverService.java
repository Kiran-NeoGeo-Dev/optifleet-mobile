package com.vts.service;

import com.vts.dto.DriverRequest;
import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.entity.Trip;
import com.vts.exception.ResourceNotFoundException;
import com.vts.repository.ClientRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.TripRepository;
import com.vts.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
    private final TripRepository    tripRepository;
    private final AuthService       authService;
    private final JwtService        jwtService;
    private final ClientRepository  clientRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final PhoneNumberNormalizer phoneNormalizer;

    public DriverService(DriverRepository driverRepository, TripRepository tripRepository,
                         AuthService authService, JwtService jwtService, 
                         ClientRepository clientRepository,
                         org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
                         PhoneNumberNormalizer phoneNormalizer) {
        this.driverRepository = driverRepository;
        this.tripRepository   = tripRepository;
        this.authService      = authService;
        this.jwtService       = jwtService;
        this.clientRepository = clientRepository;
        this.passwordEncoder  = passwordEncoder;
        this.phoneNormalizer  = phoneNormalizer;
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
        Driver driver = new Driver();
        mapRequestToDriver(request, driver);
        Long ownerId = authService.resolveResourceOwner(request.getClientId());
        driver.setClientId(ownerId);
        driver.setOrgId(resolveOrgId(ownerId));
        
        // FIX BUG-019: Normalize phone number to 10-digit format
        // Store normalized phone as username for OTP lookup
        // Also store normalized phone in phone_number field (satisfies constraint)
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            String normalizedPhone = phoneNormalizer.normalize(request.getPhoneNumber());
            driver.setPhoneNumber(normalizedPhone);
            driver.setUsername(normalizedPhone);
            log.info("[DriverService] Created driver with normalized phone/username: {} (original: {})", 
                     normalizedPhone, request.getPhoneNumber());
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

    @Transactional
    public Driver updateDriver(Long driverId, DriverRequest request) {
        Driver driver = getDriver(driverId);
        String oldDriverName = driver.getDriverName();
        
        mapRequestToDriver(request, driver);
        if (request.getClientId() != null) {
            Long ownerId = authService.resolveResourceOwner(request.getClientId());
            driver.setClientId(ownerId);
            driver.setOrgId(resolveOrgId(ownerId));
        }
        
        // FIX BUG-019: Keep phone_number and username in sync using normalized format
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
            String normalizedPhone = phoneNormalizer.normalize(request.getPhoneNumber());
            driver.setPhoneNumber(normalizedPhone);
            driver.setUsername(normalizedPhone);
            log.info("[DriverService] Updated driver phone/username to normalized format: {} (original: {})", 
                     normalizedPhone, request.getPhoneNumber());
        }
        
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            driver.setPassword(request.getPassword().trim());
        }
        driver.setUpdatedAt(LocalDateTime.now());
        Driver savedDriver = driverRepository.save(driver);
        
        // BUG-007: Synchronize driver name across all trips when driver name is updated
        String newDriverName = savedDriver.getDriverName();
        if (newDriverName != null && !newDriverName.equals(oldDriverName)) {
            List<Trip> trips = tripRepository.findByDriverId(driverId.intValue());
            if (!trips.isEmpty()) {
                log.info("[DriverService] Synchronizing driver name from '{}' to '{}' across {} trips", 
                         oldDriverName, newDriverName, trips.size());
                for (Trip trip : trips) {
                    trip.setDriverName(newDriverName);
                }
                tripRepository.saveAll(trips);
            }
        }
        
        return savedDriver;
    }

    public void deleteDriver(Long driverId) {
        driverRepository.delete(getDriver(driverId));
    }

    private void mapRequestToDriver(DriverRequest request, Driver driver) {
        driver.setDriverName(truncate(request.getDriverName(), 50));
        // Don't set phone_number here - it's set in createDriver/updateDriver with normalization
        if (request.getLicenseNumber() != null) driver.setLicenseNumber(truncate(request.getLicenseNumber(), 20));
        LocalDate expiry = parseDate(request.getLicenseExpiry());
        if (expiry != null) {
            // FIX BUG-012: Validate license expiry date
            if (expiry.isBefore(LocalDate.now())) {
                throw new IllegalArgumentException("Driver license has expired. Please provide a valid license.");
            }
            driver.setLicenseExpiry(expiry);
        }
        
        // BUG-006: Validate minimum driving age (18 years) from password field (DOB in DD/MM/YYYY format)
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            String dob = request.getPassword().trim();
            if (dob.matches("\\d{2}/\\d{2}/\\d{4}")) {
                try {
                    String[] parts = dob.split("/");
                    int day = Integer.parseInt(parts[0]);
                    int month = Integer.parseInt(parts[1]);
                    int year = Integer.parseInt(parts[2]);
                    LocalDate birthDate = LocalDate.of(year, month, day);
                    LocalDate today = LocalDate.now();
                    int age = today.getYear() - birthDate.getYear();
                    if (birthDate.plusYears(age).isAfter(today)) {
                        age--;
                    }
                    if (age < 18) {
                        throw new IllegalArgumentException("Driver does not meet the minimum required driving age.");
                    }
                } catch (NumberFormatException | java.time.DateTimeException e) {
                    // Invalid date format - let it proceed (validation happens on frontend)
                }
            }
        }
        
        if (request.getAadharNumber() != null) driver.setAadharNumber(truncate(request.getAadharNumber(), 12));
        driver.setStatus(parseStatus(request.getStatus()));
        driver.setComments(request.getComments() != null ? request.getComments() : driver.getComments());
        if (request.getFrontFaceImage() != null) driver.setFrontFaceImage(request.getFrontFaceImage());
        if (request.getLeftFaceImage()  != null) driver.setLeftFaceImage(request.getLeftFaceImage());
        if (request.getRightFaceImage() != null) driver.setRightFaceImage(request.getRightFaceImage());
    }
}
