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

    public DriverAuthController(DriverRepository driverRepository, JwtService jwtService) {
        this.driverRepository = driverRepository;
        this.jwtService       = jwtService;
    }

    /**
     * Driver login: Mobile Number (username) + Date of Birth (password, DD/MM/YYYY).
     * Both fields are matched as plain text — no hashing.
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
        User driverUser = new User(
            username, "",
            List.of(new SimpleGrantedAuthority("ROLE_DRIVER"))
        );
        return jwtService.generateToken(driverUser, claims);
    }
}
