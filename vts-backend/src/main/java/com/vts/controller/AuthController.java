package com.vts.controller;

import com.vts.dto.ClientDetailsResponse;
import com.vts.dto.LoginRequest;
import com.vts.dto.LoginResponse;
import com.vts.entity.Client;
import com.vts.entity.LoginEntity;
import com.vts.entity.UserDetailEntity;
import com.vts.service.AuthService;
import com.vts.service.EmailService;
import com.vts.repository.AdminAssociationRepository;
import com.vts.repository.AssociationRepository;
import com.vts.repository.ClientRepository;
import com.vts.repository.DeviceDriverRepository;
import com.vts.repository.DeviceRepository;
import com.vts.repository.DriverPhotoRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.LoginRepository;
import com.vts.repository.TripRepository;
import com.vts.repository.UserDetailRepository;
import com.vts.repository.VehicleRepository;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthService               authService;
    private final ClientRepository          clientRepository;
    private final PasswordEncoder           passwordEncoder;
    private final LoginRepository           loginRepository;
    private final UserDetailRepository      userDetailRepository;
    private final DriverRepository          driverRepository;
    private final DriverPhotoRepository     driverPhotoRepository;
    private final DeviceDriverRepository    deviceDriverRepository;
    private final AssociationRepository     associationRepository;
    private final AdminAssociationRepository adminAssociationRepository;
    private final TripRepository            tripRepository;
    private final VehicleRepository         vehicleRepository;
    private final DeviceRepository          deviceRepository;
    private final EmailService              emailService;
    private final EntityManager             entityManager;
    private final JdbcTemplate              jdbc;

    public AuthController(AuthService authService,
                          ClientRepository clientRepository,
                          PasswordEncoder passwordEncoder,
                          LoginRepository loginRepository,
                          UserDetailRepository userDetailRepository,
                          DriverRepository driverRepository,
                          DriverPhotoRepository driverPhotoRepository,
                          DeviceDriverRepository deviceDriverRepository,
                          AssociationRepository associationRepository,
                          AdminAssociationRepository adminAssociationRepository,
                          TripRepository tripRepository,
                          VehicleRepository vehicleRepository,
                          DeviceRepository deviceRepository,
                          EmailService emailService,
                          EntityManager entityManager,
                          JdbcTemplate jdbc) {
        this.authService               = authService;
        this.clientRepository          = clientRepository;
        this.passwordEncoder           = passwordEncoder;
        this.loginRepository           = loginRepository;
        this.userDetailRepository      = userDetailRepository;
        this.driverRepository          = driverRepository;
        this.driverPhotoRepository     = driverPhotoRepository;
        this.deviceDriverRepository    = deviceDriverRepository;
        this.associationRepository     = associationRepository;
        this.adminAssociationRepository = adminAssociationRepository;
        this.tripRepository            = tripRepository;
        this.vehicleRepository         = vehicleRepository;
        this.deviceRepository          = deviceRepository;
        this.emailService              = emailService;
        this.entityManager             = entityManager;
        this.jdbc                      = jdbc;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/forgot-password-message")
    public ResponseEntity<String> forgotPasswordMessage() {
        return ResponseEntity.ok("Please contact NeoGeo Info Technologies Ltd to reset your credentials.");
    }

    // ── Admin self-recovery: save new credentials directly ──────────────
    @PostMapping("/admin-recovery")
    public ResponseEntity<?> adminRecovery(@RequestBody Map<String, String> body) {
        try {
            String newUsername = body.get("newUsername");
            String newPassword = body.get("newPassword");
            String email       = body.get("email");

            if (newUsername == null || newUsername.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "New username is required"));
            if (newPassword == null || newPassword.length() < 6) return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
            if (email == null || email.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Email address is required"));

            String role     = (body.get("role") != null && !body.get("role").isBlank()) ? body.get("role").trim() : "Admin";
            String fullName = body.get("fullName");
            String phone    = body.get("phone");
            String roleDesc = body.get("roleDescription");

            LoginEntity login = loginRepository.findAll().stream()
                .filter(l -> "Admin".equalsIgnoreCase(l.getRole()))
                .findFirst()
                .orElse(new LoginEntity());

            Integer existingClientId = login.getClientId();

            UserDetailEntity ud = (existingClientId != null)
                ? userDetailRepository.findById(existingClientId).orElse(new UserDetailEntity())
                : new UserDetailEntity();

            ud.setUsername(newUsername.trim());
            ud.setRole(role);
            ud.setEmailAddress(email.trim());
            if (fullName != null && !fullName.isBlank()) ud.setFullName(fullName.trim());
            if (phone != null && !phone.isBlank()) {
                ud.setDialCode("+91");
                ud.setPhoneNumber(phone.trim());
            } else if (ud.getPhoneNumber() == null || ud.getPhoneNumber().isBlank()) {
                ud.setPhoneNumber("0000000000");
            }
            if (roleDesc != null && !roleDesc.isBlank()) ud.setRoleDescription(roleDesc.trim());
            UserDetailEntity savedUd = userDetailRepository.save(ud);

            login.setUsername(newUsername.trim());
            login.setPassword(passwordEncoder.encode(newPassword.trim()));
            login.setRole(role);
            login.setClientId(savedUd.getClientId());
            loginRepository.save(login);

            // Send credentials email to admin
            emailService.sendCredentialsEmail(email.trim(), fullName, newUsername.trim(), newPassword.trim());

            return ResponseEntity.ok(Map.of("message", "Admin credentials updated successfully", "username", newUsername.trim()));
        } catch (Exception e) {
            logger.error("Admin recovery error: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/client-details")
    public ResponseEntity<ClientDetailsResponse> getClientDetails() {
        Client client = authService.getCurrentClient();
        if (client == null) return ResponseEntity.status(401).build();
        ClientDetailsResponse response = new ClientDetailsResponse(
            client.getId(), client.getUsername(), client.getFullName(),
            client.getEmailAddress(), client.getDialCode(), client.getPhoneNumber(),
            client.getRole(), client.getRoleDescription()
        );
        return ResponseEntity.ok(response);
    }

    // ── Admin: Create a new client account ────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @PostMapping("/create-client")
    public ResponseEntity<?> createClient(@RequestBody Map<String, String> body) {
        try {
            String username = body.get("username");
            if (clientRepository.findByUsername(username).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
            }
            String email = body.get("emailAddress");
            if (email != null && !email.isBlank() &&
                userDetailRepository.findByEmailAddress(email).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email address already exists"));
            }
            String role  = body.getOrDefault("role", "Client");
            String phone = body.getOrDefault("phoneNumber", "0000000000");

            UserDetailEntity ud = new UserDetailEntity();
            ud.setUsername(username);
            ud.setFullName(body.get("fullName"));
            ud.setEmailAddress(body.get("emailAddress"));
            ud.setDialCode("+91");
            ud.setPhoneNumber(phone.isBlank() ? "0000000000" : phone);
            ud.setRole(role);
            ud.setRoleDescription(body.getOrDefault("roleDescription", ""));
            UserDetailEntity savedUd = userDetailRepository.save(ud);

            LoginEntity login = new LoginEntity();
            login.setUsername(username);
            login.setPassword(passwordEncoder.encode(body.get("password")));
            login.setRole(role);
            login.setClientId(savedUd.getClientId());
            loginRepository.save(login);

            // Send credentials email to new user
            emailService.sendCredentialsEmail(
                body.get("emailAddress"), body.get("fullName"), username, body.get("password"));

            return ResponseEntity.ok(Map.of("message", "Client account created successfully", "username", username));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Admin: List all client accounts ──────────────────────────────────────
    @GetMapping("/all-clients")
    public ResponseEntity<List<Map<String, Object>>> getAllClients() {
        List<Map<String, Object>> clients = clientRepository.findAll().stream()
            .map(c -> Map.<String, Object>of(
                "client_id", c.getId(),
                "username",  c.getUsername(),
                "full_name", c.getFullName() != null ? c.getFullName() : "",
                "role",      c.getRole() != null ? c.getRole() : ""
            ))
            .collect(Collectors.toList());
        return ResponseEntity.ok(clients);
    }

    // ── Admin: List all users (full detail, no password) ─────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @GetMapping("/all-users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<Map<String, Object>> users = userDetailRepository.findAll().stream()
            .map(u -> {
                java.util.Map<String, Object> m = new java.util.HashMap<>();
                m.put("client_id",           u.getClientId());
                m.put("username",            u.getUsername() != null ? u.getUsername() : "");
                m.put("full_name",           u.getFullName() != null ? u.getFullName() : "");
                m.put("email_address",       u.getEmailAddress() != null ? u.getEmailAddress() : "");
                m.put("phone_number",        u.getPhoneNumber() != null ? u.getPhoneNumber() : "");
                m.put("dial_code",           u.getDialCode() != null ? u.getDialCode() : "");
                m.put("role",                u.getRole() != null ? u.getRole() : "");
                m.put("role_description",    u.getRoleDescription() != null ? u.getRoleDescription() : "");
                m.put("created_at",          u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
                m.put("created_by_admin_id", u.getCreatedByAdminId());
                return m;
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    // ── Admin: Get single user ────────────────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @GetMapping("/users/{clientId}")
    public ResponseEntity<?> getUser(@PathVariable Integer clientId) {
        return userDetailRepository.findById(clientId)
            .map(u -> {
                java.util.Map<String, Object> m = new java.util.HashMap<>();
                m.put("client_id",           u.getClientId());
                m.put("username",            u.getUsername() != null ? u.getUsername() : "");
                m.put("full_name",           u.getFullName() != null ? u.getFullName() : "");
                m.put("email_address",       u.getEmailAddress() != null ? u.getEmailAddress() : "");
                m.put("phone_number",        u.getPhoneNumber() != null ? u.getPhoneNumber() : "");
                m.put("dial_code",           u.getDialCode() != null ? u.getDialCode() : "");
                m.put("role",                u.getRole() != null ? u.getRole() : "");
                m.put("role_description",    u.getRoleDescription() != null ? u.getRoleDescription() : "");
                m.put("created_at",          u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
                m.put("created_by_admin_id", u.getCreatedByAdminId());
                return ResponseEntity.ok(m);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Admin: Update user details ────────────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @PutMapping("/users/{clientId}")
    public ResponseEntity<?> updateUser(@PathVariable Integer clientId, @RequestBody Map<String, String> body) {
        try {
            UserDetailEntity ud = userDetailRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            if (body.containsKey("fullName"))        ud.setFullName(body.get("fullName"));
            if (body.containsKey("emailAddress"))    ud.setEmailAddress(body.get("emailAddress"));
            if (body.containsKey("phoneNumber"))     ud.setPhoneNumber(body.get("phoneNumber"));
            if (body.containsKey("role"))            ud.setRole(body.get("role"));
            if (body.containsKey("roleDescription")) ud.setRoleDescription(body.get("roleDescription"));
            if (body.containsKey("dialCode"))        ud.setDialCode(body.get("dialCode"));

            String newUsername = body.get("newUsername");
            String newPassword = body.get("newPassword");
            String oldUsername = ud.getUsername();

            // ── Username update ──────────────────────────────────────────────
            if (newUsername != null && !newUsername.isBlank()) {
                if (newUsername.trim().length() < 3)
                    return ResponseEntity.badRequest().body(Map.of("error", "Username must be at least 3 characters"));
                if (!newUsername.trim().equals(oldUsername) &&
                    userDetailRepository.findByUsername(newUsername.trim()).isPresent())
                    return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
                ud.setUsername(newUsername.trim());
            }

            userDetailRepository.save(ud);

            // ── Password + login record update ───────────────────────────────
            String effectiveUsername = (newUsername != null && !newUsername.isBlank())
                ? newUsername.trim() : oldUsername;

            // Update login record username if changed
            if (newUsername != null && !newUsername.isBlank() && !newUsername.trim().equals(oldUsername)) {
                loginRepository.findByUsername(oldUsername).ifPresent(l -> {
                    l.setUsername(newUsername.trim());
                    loginRepository.save(l);
                });
            }

            // Update password if provided
            if (newPassword != null && !newPassword.isBlank()) {
                if (newPassword.trim().length() < 6)
                    return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
                loginRepository.findByUsername(effectiveUsername).ifPresent(l -> {
                    l.setPassword(passwordEncoder.encode(newPassword.trim()));
                    loginRepository.save(l);
                });
            }

            // Update role in login if changed
            if (body.containsKey("role")) {
                loginRepository.findByUsername(effectiveUsername).ifPresent(l -> {
                    l.setRole(body.get("role"));
                    loginRepository.save(l);
                });
            }

            // ── Send SMTP email if credentials were updated ──────────────────
            boolean credentialsChanged = (newUsername != null && !newUsername.isBlank())
                || (newPassword != null && !newPassword.isBlank());
            if (credentialsChanged && ud.getEmailAddress() != null && !ud.getEmailAddress().isBlank()) {
                String emailUsername = (newUsername != null && !newUsername.isBlank()) ? newUsername.trim() : oldUsername;
                String emailPassword = (newPassword != null && !newPassword.isBlank()) ? newPassword.trim() : "(unchanged)";
                emailService.sendUpdatedCredentialsEmail(
                    ud.getEmailAddress(), ud.getFullName(), emailUsername, emailPassword);
            }

            return ResponseEntity.ok(Map.of("message", "User updated successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Admin: Cascade delete user and ALL related data ───────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @DeleteMapping("/users/{clientId}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Integer clientId) {
        try {
            logger.info("[DELETE] Starting cascade delete for clientId={}", clientId);

            // Pure JDBC — guaranteed execution order, no Hibernate flush issues
            jdbc.update("DELETE FROM public.driver_photos dp USING public.drivers d WHERE dp.driver_id = d.id AND d.client_id = ?", clientId);
            jdbc.update("DELETE FROM public.associations WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.admin_associations aa USING public.vehicles v WHERE aa.vehicle_id = v.id AND v.client_id = ?", clientId);
            jdbc.update("DELETE FROM public.admin_associations aa USING public.devices d WHERE aa.device_id = d.id AND d.client_id = ?", clientId);
            jdbc.update("DELETE FROM public.trips WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.vehicles WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.drivers WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.devices WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.login WHERE client_id = ?", clientId);
            jdbc.update("DELETE FROM public.device_tb_mapping WHERE associated_user_id = ?", clientId);
            jdbc.update("DELETE FROM public.userdetail WHERE client_id = ?", clientId);

            logger.info("[DELETE] Success for clientId={}", clientId);
            return ResponseEntity.ok(Map.of("message", "User and all related data deleted successfully"));
        } catch (Exception e) {
            logger.error("[DELETE] Failed for clientId={}: {}", clientId, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
