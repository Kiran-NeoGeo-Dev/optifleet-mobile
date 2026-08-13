package com.vts.controller;

import com.vts.entity.Driver;
import com.vts.repository.DriverRepository;
import com.vts.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/driver-auth")
public class DriverAuthController {

    private static final Logger log = LoggerFactory.getLogger(DriverAuthController.class);

    private final DriverRepository driverRepository;
    private final JwtService       jwtService;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final com.vts.service.OtpService otpService;

    public DriverAuthController(DriverRepository driverRepository, JwtService jwtService,
                                org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
                                com.vts.service.OtpService otpService) {
        this.driverRepository = driverRepository;
        this.jwtService       = jwtService;
        this.passwordEncoder  = passwordEncoder;
        this.otpService       = otpService;
    }

    /**
     * Send OTP to driver's mobile number.
     * Step 1 of OTP-based login flow.
     */
    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> body) {
        log.info("[DriverAuth] ===== SEND OTP REQUEST RECEIVED =====");
        log.info("[DriverAuth] Request body: {}", body);
        
        String mobileNumber = body.get("mobileNumber");
        log.info("[DriverAuth] Mobile number from request: {}", mobileNumber);

        if (mobileNumber == null || mobileNumber.isBlank()) {
            log.warn("[DriverAuth] Mobile number is missing or blank");
            return ResponseEntity.badRequest().body(Map.of("error", "Mobile number is required"));
        }

        String cleanMobile = mobileNumber.trim().replaceAll("^\\+91", "");
        log.info("[DriverAuth] Clean mobile number: {}", cleanMobile);

        // Validate mobile number format (10 digits starting with 6-9)
        if (!cleanMobile.matches("^[6-9]\\d{9}$")) {
            log.warn("[DriverAuth] Invalid mobile number format: {}", cleanMobile);
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid mobile number format"));
        }

        // Check if driver exists with this mobile number
        log.info("[DriverAuth] Looking up driver by username: {}", cleanMobile);
        Driver driver = driverRepository.findByUsername(cleanMobile).orElse(null);
        if (driver == null) {
            log.warn("[DriverAuth] Driver not found with mobile: {}", cleanMobile);
            return ResponseEntity.status(404).body(Map.of("error", "Driver not found with this mobile number"));
        }
        log.info("[DriverAuth] Driver found - ID: {}, Name: {}, Status: {}", driver.getId(), driver.getDriverName(), driver.getStatus());

        // Check if driver account is active
        if (driver.getStatus() == null || !driver.getStatus()) {
            log.warn("[DriverAuth] Driver account inactive - ID: {}", driver.getId());
            return ResponseEntity.status(403).body(Map.of("error", "Driver account is inactive. Contact admin."));
        }

        // Send OTP
        log.info("[DriverAuth] Calling OtpService to send OTP to: {}", cleanMobile);
        boolean sent = otpService.sendOtp(cleanMobile);
        log.info("[DriverAuth] OTP send result: {}", sent);
        
        if (!sent) {
            log.error("[DriverAuth] Failed to send OTP to: {}", cleanMobile);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to send OTP. Please try again."));
        }

        log.info("[DriverAuth] OTP sent successfully to mobile={} driverId={}", cleanMobile, driver.getId());

        return ResponseEntity.ok(Map.of(
            "message", "OTP sent successfully to your mobile number",
            "mobile", cleanMobile
        ));
    }

    /**
     * Verify OTP and login driver.
     * Step 2 of OTP-based login flow.
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> body) {
        String mobileNumber = body.get("mobileNumber");
        String otp = body.get("otp");

        if (mobileNumber == null || mobileNumber.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Mobile number is required"));
        if (otp == null || otp.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "OTP is required"));

        String cleanMobile = mobileNumber.trim().replaceAll("^\\+91", "");
        String cleanOtp = otp.trim();

        // Verify OTP
        boolean verified = otpService.verifyOtp(cleanMobile, cleanOtp);
        if (!verified)
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired OTP"));

        // Get driver details
        Driver driver = driverRepository.findByUsername(cleanMobile).orElse(null);
        if (driver == null)
            return ResponseEntity.status(404).body(Map.of("error", "Driver not found"));

        if (driver.getStatus() == null || !driver.getStatus())
            return ResponseEntity.status(403).body(Map.of("error", "Driver account is inactive. Contact admin."));

        // Generate JWT token
        String token = buildDriverToken(driver, cleanMobile);
        log.info("[DriverAuth] OTP login success for mobile={} driverId={}", cleanMobile, driver.getId());

        return ResponseEntity.ok(Map.of(
            "token",      token,
            "clientId",   driver.getClientId() != null ? driver.getClientId() : 0,
            "username",   cleanMobile,
            "role",       "Driver",
            "driverName", driver.getDriverName() != null ? driver.getDriverName() : ""
        ));
    }

    /**
     * Driver login: Mobile Number (username) + Date of Birth (password, DD/MM/YYYY).
     * Password comparison is plain text as per system requirement.
     * 
     * @deprecated This endpoint is kept for backward compatibility but is no longer the primary login method.
     * New clients should use OTP-based login (/send-otp and /verify-otp).
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String mobileNumber = body.get("mobileNumber");
        String dateOfBirth  = body.get("dateOfBirth");

        if (mobileNumber == null || mobileNumber.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Mobile number is required"));
        if (dateOfBirth == null || dateOfBirth.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Date of birth is required"));

        String cleanMobile = mobileNumber.trim().replaceAll("^\\+91", "");
        String cleanDob    = dateOfBirth.trim();

        Driver driver = driverRepository.findByUsername(cleanMobile).orElse(null);
        if (driver == null)
            return ResponseEntity.status(401).body(Map.of("error", "Invalid Mobile Number or Date of Birth"));

        // Plain text password comparison as per system requirement
        if (driver.getPassword() == null || !driver.getPassword().equals(cleanDob))
            return ResponseEntity.status(401).body(Map.of("error", "Invalid Mobile Number or Date of Birth"));

        if (driver.getStatus() == null || !driver.getStatus())
            return ResponseEntity.status(403).body(Map.of("error", "Driver account is inactive. Contact admin."));

        String token = buildDriverToken(driver, cleanMobile);
        log.info("[DriverAuth] Login success for mobile={} driverId={}", cleanMobile, driver.getId());

        return ResponseEntity.ok(Map.of(
            "token",      token,
            "clientId",   driver.getClientId() != null ? driver.getClientId() : 0,
            "username",   cleanMobile,
            "role",       "Driver",
            "driverName", driver.getDriverName() != null ? driver.getDriverName() : ""
        ));
    }

    private String buildDriverToken(Driver driver, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("clientId", driver.getClientId());
        claims.put("driverId", driver.getId());
        claims.put("orgId",    driver.getOrgId());
        claims.put("role",     "Driver");
        User driverUser = new User(
            username, "",
            List.of(new SimpleGrantedAuthority("ROLE_DRIVER"))
        );
        return jwtService.generateToken(driverUser, claims);
    }
}
