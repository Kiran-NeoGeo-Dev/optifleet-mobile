package com.vts.service;

import com.vts.config.ThingsBoardConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;

@Service
public class ThingsBoardAuthService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardAuthService.class);

    private final ThingsBoardConfig config;
    private final RestTemplate      restTemplate = new RestTemplate();
    private String  cachedToken;
    private Instant tokenExpiry;

    public ThingsBoardAuthService(ThingsBoardConfig config) {
        this.config = config;
    }

    public synchronized String getJwtToken() {
        if (cachedToken != null && tokenExpiry != null && Instant.now().isBefore(tokenExpiry))
            return cachedToken;
        return refreshToken();
    }

    /** Force a fresh login — called when a 401 is received on any API call. */
    public synchronized String forceRefresh() {
        cachedToken = null;
        tokenExpiry = null;
        return refreshToken();
    }

    private String refreshToken() {
        String token = loginTo(config.getPrimaryUrl());
        if (token != null) {
            if (config.isUsingFallback()) config.switchToPrimary();
            return token;
        }
        token = loginTo(config.getFallbackUrl());
        if (token != null) {
            config.switchToFallback();
            return token;
        }
        throw new RuntimeException("Cannot connect to any ThingsBoard server");
    }

    @SuppressWarnings("unchecked")
    private String loginTo(String baseUrl) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, String> body = Map.of("username", config.getUsername(), "password", config.getPassword());
            ResponseEntity<Map> res = restTemplate.postForEntity(
                baseUrl + "/api/auth/login", new HttpEntity<>(body, headers), Map.class);
            if (res.getBody() != null && res.getBody().containsKey("token")) {
                cachedToken = (String) res.getBody().get("token");
                tokenExpiry = Instant.now().plusSeconds(3480); // 58 min
                log.info("ThingsBoard login OK: {}", baseUrl);
                return cachedToken;
            }
        } catch (Exception e) {
            log.warn("ThingsBoard login failed {}: {}", baseUrl, e.getMessage());
        }
        return null;
    }

    public HttpEntity<String> authEntity() {
        HttpHeaders h = new HttpHeaders();
        h.set("X-Authorization", "Bearer " + getJwtToken());
        return new HttpEntity<>(h);
    }

    public String activeUrl() { return config.getActiveUrl(); }
}
