package com.vts.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ThingsBoardService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardService.class);

    @Value("${tb.host.primary}")  private String primaryHost;
    @Value("${tb.port.primary}")  private String primaryPort;
    @Value("${tb.host.fallback}") private String fallbackHost;
    @Value("${tb.port.fallback}") private String fallbackPort;
    @Value("${tb.username}")      private String tbUsername;
    @Value("${tb.password}")      private String tbPassword;

    // RestTemplate with 3s connect + 5s read timeout — never blocks dashboard
    private final RestTemplate restTemplate;

    public ThingsBoardService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    // ── Resolve working TB URL (primary → fallback) ───────────────────────────
    private String resolveBaseUrl() {
        String primary = "http://" + primaryHost + ":" + primaryPort;
        try {
            restTemplate.getForEntity(primary + "/api/v1/health", String.class);
            log.info("ThingsBoard: using primary {}", primary);
            return primary;
        } catch (Exception e) {
            String fallback = "http://" + fallbackHost + ":" + fallbackPort;
            log.warn("ThingsBoard primary unreachable ({}), switching to fallback {}", e.getMessage(), fallback);
            return fallback;
        }
    }

    // ── Login → JWT token ─────────────────────────────────────────────────────
    private String getToken(String baseUrl) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "application/json");

            Map<String, String> body = new HashMap<>();
            body.put("username", tbUsername);
            body.put("password", tbPassword);

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
            String loginUrl = baseUrl + "/api/auth/login";
            log.info("ThingsBoard login → {}", loginUrl);

            ResponseEntity<Map> res = restTemplate.postForEntity(loginUrl, entity, Map.class);
            if (res.getStatusCode() == HttpStatus.OK && res.getBody() != null) {
                String token = (String) res.getBody().get("token");
                log.info("ThingsBoard token: {}", token != null ? "OK" : "NULL");
                return token;
            }
        } catch (Exception e) {
            log.error("ThingsBoard login failed: {}", e.getMessage());
        }
        return null;
    }

    // ── Count devices where state = STARTED ──────────────────────────────────
    private long countByState(String baseUrl, String token) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Authorization", "Bearer " + token);
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> entityFilter = new HashMap<>();
            entityFilter.put("type", "entityType");
            entityFilter.put("entityType", "DEVICE");

            Map<String, Object> keyDef = new HashMap<>();
            keyDef.put("type", "TIME_SERIES");
            keyDef.put("key", "trip_status");

            Map<String, Object> predicateValue = new HashMap<>();
            predicateValue.put("defaultValue", "STARTED");

            Map<String, Object> predicate = new HashMap<>();
            predicate.put("type", "STRING");
            predicate.put("operation", "EQUAL");
            predicate.put("value", predicateValue);

            Map<String, Object> keyFilter = new HashMap<>();
            keyFilter.put("key", keyDef);
            keyFilter.put("valueType", "STRING");
            keyFilter.put("predicate", predicate);

            Map<String, Object> pageLink = new HashMap<>();
            pageLink.put("pageSize", 100);
            pageLink.put("page", 0);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("entityFilter", entityFilter);
            requestBody.put("keyFilters", new Object[]{keyFilter});
            requestBody.put("pageLink", pageLink);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                baseUrl + "/api/entitiesQuery/find", entity, Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Object total = response.getBody().get("totalElements");
                if (total instanceof Number) return ((Number) total).longValue();
            }
        } catch (Exception e) {
            log.error("ThingsBoard query failed: {}", e.getMessage());
        }
        return 0;
    }

    public long getActiveVehiclesCount() {
        try {
            String baseUrl = resolveBaseUrl();
            String token   = getToken(baseUrl);
            if (token == null) return 0;
            return countByState(baseUrl, token);
        } catch (Exception e) {
            log.error("ThingsBoard getActiveVehiclesCount error: {}", e.getMessage());
            return 0;
        }
    }

    public long getActiveDriversCount() {
        return getActiveVehiclesCount();
    }
}
