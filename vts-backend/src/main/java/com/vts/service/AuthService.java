package com.vts.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.vts.dto.LoginRequest;
import com.vts.dto.LoginResponse;
import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.entity.LoginEntity;
import com.vts.entity.UserDetailEntity;
import com.vts.repository.ClientRepository;
import com.vts.repository.DriverRepository;
import com.vts.repository.LoginRepository;
import com.vts.repository.UserDetailRepository;
import com.vts.security.JwtService;

@Service
public class AuthService {
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final JwtService jwtService;
    private final ClientRepository clientRepository;
    private final DriverRepository driverRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginRepository loginRepository;
    private final UserDetailRepository userDetailRepository;

    public AuthService(
            JwtService jwtService,
            ClientRepository clientRepository,
            DriverRepository driverRepository,
            PasswordEncoder passwordEncoder,
            LoginRepository loginRepository,
            UserDetailRepository userDetailRepository
    ) {
        this.jwtService = jwtService;
        this.clientRepository = clientRepository;
        this.driverRepository = driverRepository;
        this.passwordEncoder = passwordEncoder;
        this.loginRepository = loginRepository;
        this.userDetailRepository = userDetailRepository;
    }

    /** Extract clientId from JWT token in current request. */
    private Long extractClientIdFromToken() {
        try {
            var request = ((org.springframework.web.context.request.ServletRequestAttributes)
                org.springframework.web.context.request.RequestContextHolder.getRequestAttributes()).getRequest();
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                io.jsonwebtoken.Claims claims = jwtService.extractAllClaims(token);
                Object clientIdObj = claims.get("clientId");
                if (clientIdObj != null) {
                    return Long.parseLong(clientIdObj.toString());
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to extract clientId from token: {}", e.getMessage());
        }
        return null;
    }

    public LoginResponse login(LoginRequest request) {
        logger.info("LOGIN ATTEMPT: username={}", request.getUsername());

        // Check drivers table first
        var driverOpt = driverRepository.findByUsername(request.getUsername());
        if (driverOpt.isPresent()) {
            Driver driver = driverOpt.get();
            if (driver.getPassword() == null || !passwordEncoder.matches(request.getPassword(), driver.getPassword())) {
                logger.error("DRIVER AUTH FAILED: {}", request.getUsername());
                throw new BadCredentialsException("Invalid username or password");
            }
            Map<String, Object> driverClaims = new HashMap<>();
            driverClaims.put("clientId", driver.getClientId());
            driverClaims.put("driverId", driver.getId());
            driverClaims.put("orgId", driver.getOrgId());
            driverClaims.put("role", "Driver");
            org.springframework.security.core.userdetails.User driverUser =
                new org.springframework.security.core.userdetails.User(
                    driver.getUsername(), driver.getPassword(),
                    java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_DRIVER"))
                );
            String driverToken = jwtService.generateToken(driverUser, driverClaims);
            logger.info("DRIVER LOGIN SUCCESS: {}", request.getUsername());
            return new LoginResponse(driverToken, driver.getClientId(), driver.getUsername(), "Driver", driver.getOrgId());
        }

        // Look up in userdetail
        Client dbClient = clientRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> {
                    logger.error("USER NOT FOUND in database: {}", request.getUsername());
                    return new BadCredentialsException("Invalid username or password");
                });

        // Look up password from login table
        LoginEntity loginEntity = loginRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));
        String dbPassword = loginEntity.getPassword();

        logger.info("USER FOUND: id={}, username={}", dbClient.getId(), dbClient.getUsername());

        // Verify password directly — no AuthenticationManager needed
        if (!passwordEncoder.matches(request.getPassword(), dbPassword)) {
            logger.error("AUTHENTICATION FAILED: invalid password for {}", request.getUsername());
            throw new BadCredentialsException("Invalid username or password");
        }
        logger.info("AUTHENTICATION SUCCESS: {}", request.getUsername());

        org.springframework.security.core.userdetails.User userDetails =
            new org.springframework.security.core.userdetails.User(
                dbClient.getUsername(), dbPassword,
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                    "ROLE_" + (dbClient.getRole() != null ? dbClient.getRole().toUpperCase() : "CLIENT")))
            );
        UsernamePasswordAuthenticationToken authToken =
            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(authToken);

        Map<String, Object> claims = new HashMap<>();
        claims.put("clientId", dbClient.getId());
        claims.put("orgId", dbClient.getOrgId());
        claims.put("role", dbClient.getRole());

        String token = jwtService.generateToken(userDetails, claims);
        return new LoginResponse(token, dbClient.getId(), dbClient.getUsername(), dbClient.getRole(), dbClient.getOrgId());
    }

    public Client getCurrentClient() {
        // PRIORITY 1: Extract clientId from JWT token
        Long clientId = extractClientIdFromToken();
        if (clientId != null) {
            return clientRepository.findById(clientId).orElse(null);
        }

        // PRIORITY 2: Fallback to username lookup
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String username = authentication.getName();
        return clientRepository.findByUsername(username).orElse(null);
    }

    public boolean isAdminRole() {
        // First check JWT role claim directly (works even if DB lookup fails)
        try {
            var request = ((org.springframework.web.context.request.ServletRequestAttributes)
                org.springframework.web.context.request.RequestContextHolder.getRequestAttributes()).getRequest();
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                io.jsonwebtoken.Claims claims = jwtService.extractAllClaims(token);
                Object roleObj = claims.get("role");
                if (roleObj != null) {
                    String role = roleObj.toString();
                    if ("superadmin".equalsIgnoreCase(role) || "admin".equalsIgnoreCase(role)) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("isAdminRole JWT check failed: {}", e.getMessage());
        }
        // Fallback to DB lookup
        Client client = getCurrentClient();
        return client != null && (isAdmin(client) || isSuperAdmin(client));
    }

    public boolean isSuperAdmin() {
        return isSuperAdmin(getCurrentClient());
    }

    public boolean isOrganizationAdmin() {
        return isAdmin(getCurrentClient());
    }

    public boolean isSuperAdmin(Client client) {
        return client != null && "superadmin".equalsIgnoreCase(client.getRole());
    }

    public boolean isAdmin(Client client) {
        return client != null && "admin".equalsIgnoreCase(client.getRole());
    }

    public boolean isUser(Client client) {
        if (client == null || client.getRole() == null) return false;
        return "user".equalsIgnoreCase(client.getRole()) || "client".equalsIgnoreCase(client.getRole());
    }

    public Long getCurrentOrgId() {
        Client client = getCurrentClient();
        return client != null ? client.getOrgId() : null;
    }

    public boolean canAccessClient(Integer targetClientId) {
        Client current = getCurrentClient();
        if (current == null) return false;
        if (targetClientId == null) return true; // null means "use own clientId" — always allowed
        if (isSuperAdmin(current)) return true;
        if (current.getId() != null && current.getId().intValue() == targetClientId) return true;
        if (!isAdmin(current) || current.getOrgId() == null) return false;
        return userDetailRepository.findByClientIdAndOrgId(targetClientId, current.getOrgId()).isPresent();
    }

    public Long resolveResourceOwner(Long requestedClientId) {
        Client current = getCurrentClient();
        if (current == null) throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        Long ownerId = requestedClientId != null ? requestedClientId : current.getId();
        if (!canAccessClient(ownerId.intValue())) {
            throw new org.springframework.security.access.AccessDeniedException("Target account is outside your organization");
        }
        return ownerId;
    }

    public Long resolveResourceOrgId(Long ownerClientId) {
        UserDetailEntity owner = userDetailRepository.findById(ownerClientId.intValue())
                .orElseThrow(() -> new IllegalArgumentException("Resource owner not found"));
        if (owner.getOrgId() == null) throw new IllegalStateException("Resource owner has no organization assignment");
        return owner.getOrgId();
    }

    public void requireOrgAccess(Long resourceOrgId, Long resourceClientId) {
        Client current = getCurrentClient();
        if (current == null) throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        if (isSuperAdmin(current)) return;
        // if resource has no org assigned, allow access by clientId match
        if (resourceOrgId == null) {
            if (resourceClientId != null && current.getId().equals(resourceClientId)) return;
            if (isAdmin(current)) return; // org admin can manage unassigned resources
            throw new org.springframework.security.access.AccessDeniedException("Resource is outside your access scope");
        }
        if (isAdmin(current) && current.getOrgId() != null && current.getOrgId().equals(resourceOrgId)) return;
        if (resourceClientId != null && current.getId().equals(resourceClientId)) return;
        throw new org.springframework.security.access.AccessDeniedException("Resource is outside your access scope");
    }

    public Client createClient(String username, String rawPassword) {
        UserDetailEntity ud = new UserDetailEntity();
        ud.setUsername(username);
        ud.setPhoneNumber("0000000000");
        ud.setRole("Client");
        Client creator = getCurrentClient();
        if (creator != null) {
            ud.setCreatedByAdminId(creator.getId().intValue());
            ud.setOrgId(creator.getOrgId());
        }
        UserDetailEntity savedUd = userDetailRepository.save(ud);

        LoginEntity login = new LoginEntity();
        login.setUsername(username);
        login.setPassword(passwordEncoder.encode(rawPassword));
        login.setRole("Client");
        login.setClientId(savedUd.getClientId());
        loginRepository.save(login);

        return clientRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Client not found after creation"));
    }
}
