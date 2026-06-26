package com.vts.security;

import com.vts.entity.Client;
import com.vts.entity.Driver;
import com.vts.repository.ClientRepository;
import com.vts.repository.DriverRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {
    private static final Logger logger = LoggerFactory.getLogger(CustomUserDetailsService.class);

    private final ClientRepository clientRepository;
    private final DriverRepository driverRepository;

    public CustomUserDetailsService(ClientRepository clientRepository, DriverRepository driverRepository) {
        this.clientRepository = clientRepository;
        this.driverRepository = driverRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        logger.info("LOADING USER DETAILS: {}", username);

        var driverOpt = driverRepository.findByUsername(username);
        if (driverOpt.isPresent()) {
            Driver driver = driverOpt.get();
            return User.withUsername(driver.getUsername())
                    .password(driver.getPassword() != null ? driver.getPassword() : "")
                    .authorities(List.of(new SimpleGrantedAuthority("ROLE_DRIVER")))
                    .build();
        }

        Client client = clientRepository.findByUsername(username)
                .orElseThrow(() -> {
                    logger.error("USER NOT FOUND: {}", username);
                    return new UsernameNotFoundException("User not found: " + username);
                });

        logger.info("CLIENT LOADED: id={}, username={}", client.getId(), client.getUsername());
        String normalizedRole = client.getRole() == null
                ? "USER"
                : client.getRole().replaceAll("[^A-Za-z0-9]", "_").toUpperCase();

        return User.withUsername(client.getUsername())
                .password(client.getPassword())
                .authorities(List.of(
                        new SimpleGrantedAuthority("ROLE_CLIENT"),
                        new SimpleGrantedAuthority("ROLE_" + normalizedRole)))
                .build();
    }
}
