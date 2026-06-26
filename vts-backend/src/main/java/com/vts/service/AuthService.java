package com.vts.service;

import java.util.HashMap;
import java.util.Map;

import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
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

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final ClientRepository clientRepository;
    private final DriverRepository driverRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginRepository loginRepository;
    private final UserDetailRepository userDetailRepository;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserDetailsService userDetailsService,
            JwtService jwtService,
            ClientRepository clientRepository,
            DriverRepository driverRepository,
            PasswordEncoder passwordEncoder,
            LoginRepository loginRepository,
            UserDetailRepository userDetailRepository
    ) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
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

        // Check drivers table first for Driver role login
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

        // Fall back to clients table
        var clientOpt = clientRepository.findByUsername(request.getUsername());
        if (clientOpt.isEmpty()) {
            logger.error("USER NOT FOUND in database: {}", request.getUsername());
            throw new BadCredentialsException("Invalid username or password");
        }

        Client dbClient = clientOpt.get();
        logger.info("USER FOUND: id={}, username={}, password_hash={}",
            dbClient.getId(), dbClient.getUsername(),
            dbClient.getPassword().substring(0, Math.min(20, dbClient.getPassword().length())) + "...");
        
        // Try authentication
        Authentication authentication;
        try {
            logger.debug("Attempting authentication with AuthenticationManager");
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
            logger.info("AUTHENTICATION SUCCESS: {}", request.getUsername());
        } catch (BadCredentialsException ex) {
            logger.error("AUTHENTICATION FAILED: {} - {}", request.getUsername(), ex.getMessage());
            throw new BadCredentialsException("Invalid username or password");
        }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
        Client client = clientRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        Map<String, Object> claims = new HashMap<>();
        claims.put("clientId", client.getId());
        claims.put("orgId", client.getOrgId());
        claims.put("role", client.getRole());

        String token = jwtService.generateToken(userDetails, claims);

        return new LoginResponse(token, client.getId(), client.getUsername(), client.getRole(), client.getOrgId());
    }

    public Client getCurrentClient() {
        // PRIORITY 1: Extract clientId from JWT token (works for admin-as-client)
        Long clientId = extractClientIdFromToken();
        if (clientId != null) {
            return clientRepository.findById(clientId).orElse(null);
        }

        // PRIORITY 2: Fallback to username lookup (direct login)
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String username = authentication.getName();
        return clientRepository.findByUsername(username).orElse(null);
    }

    /** Used by @PreAuthorize to check if current user has Admin role. */
    public boolean isAdminRole() {
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

    /** True when the target account is visible to the authenticated account. */
    public boolean canAccessClient(Integer targetClientId) {
        Client current = getCurrentClient();
        if (current == null || targetClientId == null) return false;
        if (isSuperAdmin(current)) return true;
        if (current.getId().intValue() == targetClientId) return true;
        if (!isAdmin(current) || current.getOrgId() == null) return false;
        return userDetailRepository.findByClientIdAndOrgId(targetClientId, current.getOrgId()).isPresent();
    }

    /** Resolve a requested resource owner without allowing cross-organization assignment. */
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
        if (isAdmin(current) && current.getOrgId() != null && current.getOrgId().equals(resourceOrgId)) return;
        if (resourceClientId != null && current.getId().equals(resourceClientId)) return;
        throw new org.springframework.security.access.AccessDeniedException("Resource is outside your access scope");
    }

    public Client createClient(String username, String rawPassword) {
        // Write to userdetail first (login FK references userdetail.client_id)
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

        // Write to login using the generated client_id
        LoginEntity login = new LoginEntity();
        login.setUsername(username);
        login.setPassword(passwordEncoder.encode(rawPassword));
        login.setRole("Client");
        login.setClientId(savedUd.getClientId());
        loginRepository.save(login);

        // Return the Client object for backward compatibility
        return clientRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Client not found after creation"));
    }
}
