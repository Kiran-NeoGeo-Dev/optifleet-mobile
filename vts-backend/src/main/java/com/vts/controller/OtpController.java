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

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/driver-otp")
public class OtpController {

    private static final Logger log = LoggerFactory.getLogger(OtpController.class);
    private static final int OTP_VALIDITY_MINUTES = 5;

    private final DriverRepository driverRepository;
    private final JwtService       jwtService;

    public OtpController(DriverRepository driverRepository, JwtService jwtService) {
        this.driverRepository = driverRepository;
        this.jwtService       = jwtService;
    }

    /** Step 1: Driver enters phone number → generate & store OTP */
    @PostMapping("/generate")
    public ResponseEntity<?> generateOtp(@RequestBody Map<String, String> body) {
        String phone = body.get("phoneNumber");
        if (phone == null || phone.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Phone number is required"));

        String cleanPhone = phone.trim().replaceAll("^\\+91", "");

        Driver driver = driverRepository.findByPhoneNumber(cleanPhone).orElse(null);
        if (driver == null)
            return ResponseEntity.status(404).body(Map.of("error", "No driver found with this phone number"));

        // Generate 6-digit OTP
        String otp = String.format("%06d", new Random().nextInt(999999));
        driver.setOtp(otp);
        driver.setOtpExpiry(LocalDateTime.now().plusMinutes(OTP_VALIDITY_MINUTES));
        // Store phone as username for lookup
        driver.setUsername(cleanPhone);
        driverRepository.save(driver);

        log.info("[OTP] Generated for phone={} otp={}", cleanPhone, otp);

        // Return OTP in response so frontend can open SMS app
        return ResponseEntity.ok(Map.of(
            "message", "OTP generated successfully",
            "otp",     otp,
            "driverName", driver.getDriverName() != null ? driver.getDriverName() : ""
        ));
    }

    /** Step 2: Driver enters OTP → validate & return JWT */
    @PostMapping("/verify")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> body) {
        String phone = body.get("phoneNumber");
        String otp   = body.get("otp");

        if (phone == null || phone.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Phone number is required"));
        if (otp == null || otp.isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "OTP is required"));

        String cleanPhone = phone.trim().replaceAll("^\\+91", "");

        Driver driver = driverRepository.findByPhoneNumber(cleanPhone).orElse(null);
        if (driver == null)
            return ResponseEntity.status(404).body(Map.of("error", "No driver found with this phone number"));

        if (driver.getOtp() == null || !driver.getOtp().equals(otp.trim()))
            return ResponseEntity.status(401).body(Map.of("error", "Invalid OTP. Please try again."));

        if (driver.getOtpExpiry() == null || LocalDateTime.now().isAfter(driver.getOtpExpiry()))
            return ResponseEntity.status(401).body(Map.of("error", "OTP expired. Please request a new OTP."));

        // Clear OTP after successful use
        driver.setOtp(null);
        driver.setOtpExpiry(null);
        driverRepository.save(driver);

        // Generate JWT
        Map<String, Object> claims = new HashMap<>();
        claims.put("clientId", driver.getClientId());
        claims.put("driverId", driver.getId());

        User driverUser = new User(
            cleanPhone, "",
            List.of(new SimpleGrantedAuthority("ROLE_DRIVER"))
        );
        String token = jwtService.generateToken(driverUser, claims);

        log.info("[OTP] Verified for phone={} driverId={}", cleanPhone, driver.getId());

        return ResponseEntity.ok(Map.of(
            "token",      token,
            "clientId",   driver.getClientId() != null ? driver.getClientId() : 0,
            "username",   cleanPhone,
            "role",       "Driver",
            "driverName", driver.getDriverName() != null ? driver.getDriverName() : ""
        ));
    }
}
