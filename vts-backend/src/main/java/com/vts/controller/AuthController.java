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

    // ── Self-recovery: identify by registered email, update credentials only ──
    // Works for Admin, SuperAdmin, and User accounts
    @PostMapping("/admin-recovery")
    public ResponseEntity<?> adminRecovery(@RequestBody Map<String, String> body) {
        try {
            String email       = body.get("email");
            String newUsername = body.get("newUsername");
            String newPassword = body.get("newPassword");
            String fullName    = body.get("fullName");
            String phone       = body.get("phone");

            if (email == null || email.isBlank())
                return ResponseEntity.badRequest().body(Map.of("error", "Registered email address is required"));
            if (newUsername == null || newUsername.isBlank())
                return ResponseEntity.badRequest().body(Map.of("error", "New username is required"));
            if (newPassword == null || newPassword.length() < 6)
                return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));

            String emailTrimmed = email.trim();
            logger.info("[ADMIN_RECOVERY] Recovery attempt for email: {}", emailTrimmed);

            // Identify the admin account by registered email (case-insensitive)
            UserDetailEntity ud = userDetailRepository.findByEmailAddressIgnoreCase(emailTrimmed).orElse(null);
            
            if (ud == null) {
                logger.warn("[ADMIN_RECOVERY] No account found with email: {}", emailTrimmed);
                return ResponseEntity.badRequest().body(Map.of("error", "No account found with that email address"));
            }

            logger.info("[ADMIN_RECOVERY] Found account - username: {}, role: {}, clientId: {}", 
                ud.getUsername(), ud.getRole(), ud.getClientId());

            // Verify account has a valid role
            String existingRole = ud.getRole();
            if (existingRole == null || existingRole.isBlank()) {
                logger.warn("[ADMIN_RECOVERY] Account has no role assigned: {}", emailTrimmed);
                return ResponseEntity.badRequest().body(Map.of("error", "Account has no role assigned. Please contact support."));
            }
            
            // Allow recovery for Admin, SuperAdmin, and User accounts
            if (!"Admin".equalsIgnoreCase(existingRole) 
                && !"superadmin".equalsIgnoreCase(existingRole)
                && !"User".equalsIgnoreCase(existingRole)) {
                logger.warn("[ADMIN_RECOVERY] Account has invalid role - email: {}, role: {}", emailTrimmed, existingRole);
                return ResponseEntity.badRequest().body(Map.of("error", "Account recovery is not available for role: " + existingRole));
            }
            
            logger.info("[ADMIN_RECOVERY] Role validation passed - proceeding with recovery for role: {}", existingRole);

            // Check new username uniqueness (skip if unchanged)
            String oldUsername = ud.getUsername();
            if (!newUsername.trim().equals(oldUsername) &&
                    userDetailRepository.findByUsername(newUsername.trim()).isPresent()) {
                logger.warn("[ADMIN_RECOVERY] Username already exists: {}", newUsername.trim());
                return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
            }

            logger.info("[ADMIN_RECOVERY] Updating credentials for clientId: {}, old username: {}, new username: {}", 
                ud.getClientId(), oldUsername, newUsername.trim());

            // Update userdetail — credentials + optional profile fields only; role/org/data untouched
            ud.setUsername(newUsername.trim());
            if (fullName != null && !fullName.isBlank()) ud.setFullName(fullName.trim());
            if (phone != null && !phone.isBlank()) {
                ud.setPhoneNumber(phone.trim());
            }
            userDetailRepository.save(ud);

            // Update login record
            LoginEntity login = loginRepository.findByUsername(oldUsername)
                .orElseThrow(() -> new IllegalStateException("Login record not found for this account"));
            login.setUsername(newUsername.trim());
            login.setPassword(passwordEncoder.encode(newPassword.trim()));
            loginRepository.save(login);

            logger.info("[ADMIN_RECOVERY] Successfully updated credentials for email: {}", emailTrimmed);

            emailService.sendCredentialsEmail(emailTrimmed, ud.getFullName(), newUsername.trim(), newPassword.trim());

            return ResponseEntity.ok(Map.of("message", "Credentials updated successfully", "username", newUsername.trim()));
        } catch (Exception e) {
            logger.error("[ADMIN_RECOVERY] Recovery failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/client-details")
    public ResponseEntity<ClientDetailsResponse> getClientDetails() {
        Client client = authService.getCurrentClient();
        if (client == null) return ResponseEntity.status(401).build();
        ClientDetailsResponse response = new ClientDetailsResponse(
            client.getId(), client.getUsername(), client.getFullName(),
            client.getEmailAddress(), "", client.getPhoneNumber(),
            client.getRole(), client.getRoleDescription()
        );
        return ResponseEntity.ok(response);
    }

    // ── Admin: Create a new client account ────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @PostMapping("/create-client")
    @Transactional
    public ResponseEntity<?> createClient(@RequestBody Map<String, String> body) {
        try {
            Client creator = authService.getCurrentClient();
            if (creator == null) return ResponseEntity.status(401).build();
            String username = body.get("username") != null ? body.get("username").trim() : "";
            String rawPassword = body.get("password") != null ? body.get("password").trim() : "";
            if (username.length() < 3) return ResponseEntity.badRequest().body(Map.of("error", "Username must be at least 3 characters"));
            if (rawPassword.length() < 6) return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
            if (clientRepository.findByUsername(username).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
            }
            String email = body.get("emailAddress");
            if (email != null && !email.isBlank()) {
                // Normalize email to lowercase to prevent case-sensitivity issues
                email = email.trim().toLowerCase();
                if (userDetailRepository.findByEmailAddressIgnoreCase(email).isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Email address already exists"));
                }
            }
            String rawPhone = body.getOrDefault("phoneNumber", "").trim();
            if (!rawPhone.isBlank() && userDetailRepository.findByPhoneNumber(rawPhone).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Phone number already exists"));
            }
            String requestedRole = body.getOrDefault("role", "User").trim();
            if (!"User".equalsIgnoreCase(requestedRole) && !"Admin".equalsIgnoreCase(requestedRole)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Role must be User or Admin"));
            }
            String role = "Admin".equalsIgnoreCase(requestedRole) ? "Admin" : "User";
            if (authService.isSuperAdmin(creator) && !"Admin".equals(role)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Super Admin creates organization Admin accounts; organization Admins create Users"));
            }
            UserDetailEntity ud = new UserDetailEntity();
            ud.setUsername(username);
            ud.setFullName(body.get("fullName"));
            ud.setEmailAddress(email); // Already normalized to lowercase above
            ud.setPhoneNumber(rawPhone.isBlank() ? "0000000000" : rawPhone);
            ud.setRole(role);
            ud.setRoleDescription(body.getOrDefault("roleDescription", ""));
            ud.setCreatedByAdminId(creator.getId().intValue());
            if (!authService.isSuperAdmin(creator)) {
                if (creator.getOrgId() == null) throw new IllegalStateException("Current Admin has no organization assignment");
                ud.setOrgId(creator.getOrgId());
            }
            UserDetailEntity savedUd = userDetailRepository.save(ud);

            // A Super Admin starts a new organization; its first Admin's client ID is the org ID.
            if (authService.isSuperAdmin(creator)) {
                savedUd.setOrgId(savedUd.getClientId().longValue());
                savedUd = userDetailRepository.save(savedUd);
            }

            LoginEntity login = new LoginEntity();
            login.setUsername(username);
            login.setPassword(passwordEncoder.encode(rawPassword));
            login.setRole(role);
            login.setClientId(savedUd.getClientId());
            loginRepository.save(login);

            emailService.sendCredentialsEmail(
                body.get("emailAddress"), body.get("fullName"), username, rawPassword);

            return ResponseEntity.ok(Map.of(
                "message", role + " account created successfully",
                "username", username,
                "role", role,
                "org_id", savedUd.getOrgId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Admin: List all client accounts ──────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @GetMapping("/all-clients")
    public ResponseEntity<List<Map<String, Object>>> getAllClients() {
        Client current = authService.getCurrentClient();
        List<UserDetailEntity> visible = authService.isSuperAdmin(current)
            ? userDetailRepository.findAll()
            : userDetailRepository.findByOrgId(current.getOrgId());
        List<Map<String, Object>> clients = visible.stream()
            .map(this::toUserMap)
            .collect(Collectors.toList());
        return ResponseEntity.ok(clients);
    }

    // ── Admin: List all users (full detail, no password) ─────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @GetMapping("/all-users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        Client current = authService.getCurrentClient();
        List<UserDetailEntity> visible = authService.isSuperAdmin(current)
            ? userDetailRepository.findAll()
            : userDetailRepository.findByOrgId(current.getOrgId());
        List<Map<String, Object>> users = visible.stream()
            .map(this::toUserMap)
            .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    // ── Admin: Get single user ────────────────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @GetMapping("/users/{clientId}")
    public ResponseEntity<?> getUser(@PathVariable Integer clientId) {
        if (!authService.canAccessClient(clientId)) return ResponseEntity.status(403).build();
        return userDetailRepository.findById(clientId)
            .map(u -> ResponseEntity.ok(toUserMap(u)))
            .orElse(ResponseEntity.notFound().build());
    }

    // ── Admin: Update user details ────────────────────────────────────────────
    @PreAuthorize("hasRole('CLIENT') and @authService.isAdminRole()")
    @PutMapping("/users/{clientId}")
    public ResponseEntity<?> updateUser(@PathVariable Integer clientId, @RequestBody Map<String, String> body) {
        try {
            UserDetailEntity ud = userDetailRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            if (!authService.canAccessClient(clientId)) return ResponseEntity.status(403).body(Map.of("error", "Account is outside your organization"));
            if ("superadmin".equalsIgnoreCase(ud.getRole())) return ResponseEntity.status(403).body(Map.of("error", "Super Admin is permanent and cannot be modified here"));
            if (body.containsKey("role")) {
                String requestedRole = body.get("role");
                if (!"User".equalsIgnoreCase(requestedRole) && !"Admin".equalsIgnoreCase(requestedRole)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Role must be User or Admin"));
                }
                body.put("role", "Admin".equalsIgnoreCase(requestedRole) ? "Admin" : "User");
            }
            if (body.containsKey("fullName"))        ud.setFullName(body.get("fullName"));
            if (body.containsKey("emailAddress")) {
                String newEmail = body.get("emailAddress");
                if (newEmail != null && !newEmail.isBlank()) {
                    // Normalize email to lowercase
                    newEmail = newEmail.trim().toLowerCase();
                    userDetailRepository.findByEmailAddressIgnoreCase(newEmail).ifPresent(existing -> {
                        if (!existing.getClientId().equals(clientId))
                            throw new RuntimeException("Email address already exists");
                    });
                    ud.setEmailAddress(newEmail);
                } else {
                    ud.setEmailAddress(newEmail);
                }
            }
            if (body.containsKey("phoneNumber")) {
                String newPhone = body.get("phoneNumber");
                if (newPhone != null && !newPhone.isBlank()) {
                    userDetailRepository.findByPhoneNumber(newPhone).ifPresent(existing -> {
                        if (!existing.getClientId().equals(clientId))
                            throw new RuntimeException("Phone number already exists");
                    });
                }
                ud.setPhoneNumber(newPhone);
            }
            if (body.containsKey("role"))            ud.setRole(body.get("role"));
            if (body.containsKey("roleDescription")) ud.setRoleDescription(body.get("roleDescription"));

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

            if (newUsername != null && !newUsername.isBlank() && !newUsername.trim().equals(oldUsername)) {
                loginRepository.findByUsername(oldUsername).ifPresent(l -> {
                    l.setUsername(newUsername.trim());
                    loginRepository.save(l);
                });
            }

            if (newPassword != null && !newPassword.isBlank()) {
                if (newPassword.trim().length() < 6)
                    return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
                loginRepository.findByUsername(effectiveUsername).ifPresent(l -> {
                    l.setPassword(passwordEncoder.encode(newPassword.trim()));
                    loginRepository.save(l);
                });
            }

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
            if (!authService.canAccessClient(clientId)) return ResponseEntity.status(403).body(Map.of("error", "Account is outside your organization"));
            UserDetailEntity target = userDetailRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            Client current = authService.getCurrentClient();
            if ("superadmin".equalsIgnoreCase(target.getRole())) return ResponseEntity.status(403).body(Map.of("error", "Super Admin cannot be deleted"));
            if (current != null && current.getId().intValue() == clientId) return ResponseEntity.badRequest().body(Map.of("error", "You cannot delete your own account"));
            logger.info("[DELETE] Starting cascade delete for clientId={}", clientId);

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

    private Map<String, Object> toUserMap(UserDetailEntity u) {
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("client_id",           u.getClientId());
        m.put("username",            u.getUsername() != null ? u.getUsername() : "");
        m.put("full_name",           u.getFullName() != null ? u.getFullName() : "");
        m.put("email_address",       u.getEmailAddress() != null ? u.getEmailAddress() : "");
        m.put("phone_number",        u.getPhoneNumber() != null ? u.getPhoneNumber() : "");
        m.put("role",                u.getRole() != null ? u.getRole() : "");
        m.put("role_description",    u.getRoleDescription() != null ? u.getRoleDescription() : "");
        m.put("created_at",          u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
        m.put("created_by_admin_id", u.getCreatedByAdminId());
        m.put("org_id",              u.getOrgId());
        return m;
    }
}
