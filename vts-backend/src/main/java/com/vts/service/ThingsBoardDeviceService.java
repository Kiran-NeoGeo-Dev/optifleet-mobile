package com.vts.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles ThingsBoard device lifecycle: create, update, delete.
 * Automatically retries once with a fresh token on 401 Unauthorized.
 */
@Service
public class ThingsBoardDeviceService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardDeviceService.class);

    private final ThingsBoardAuthService authService;
    private final RestTemplate restTemplate = new RestTemplate();

    public ThingsBoardDeviceService(ThingsBoardAuthService authService) {
        this.authService = authService;
    }

    // ── Create device → returns ThingsBoard device UUID ──────────────────────

    public String createDevice(String deviceName) {
        Map<String, Object> body = Map.of("name", deviceName, "type", "default");
        try {
            return doCreate(body, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on createDevice — refreshing token and retrying");
                return doCreate(body, authService.forceRefresh());
            }
            log.error("TB createDevice failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("ThingsBoard device creation failed: " + e.getStatusCode());
        }
    }

    private String doCreate(Map<String, Object> body, String token) {
        String url = authService.activeUrl() + "/api/device";
        HttpHeaders headers = authHeaders(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> res = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
        String tbDeviceId = extractDeviceId(res.getBody());
        log.info("TB device created: name={} id={}", body.get("name"), tbDeviceId);
        return tbDeviceId;
    }

    // ── Fetch access token (credentialsId) for a TB device ───────────────────

    public String getAccessToken(String tbDeviceId) {
        try {
            return doGetAccessToken(tbDeviceId, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on getAccessToken — refreshing token and retrying");
                return doGetAccessToken(tbDeviceId, authService.forceRefresh());
            }
            log.error("TB getAccessToken failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("ThingsBoard credential fetch failed: " + e.getStatusCode());
        }
    }

    private String doGetAccessToken(String tbDeviceId, String token) {
        String url = authService.activeUrl() + "/api/device/" + tbDeviceId + "/credentials";
        ResponseEntity<Map> res = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(authHeaders(token)), Map.class);
        if (res.getBody() == null || !res.getBody().containsKey("credentialsId"))
            throw new RuntimeException("ThingsBoard did not return credentialsId");
        String accessToken = (String) res.getBody().get("credentialsId");
        log.info("TB access token fetched for device {}", tbDeviceId);
        return accessToken;
    }

    // ── Update device name in ThingsBoard ────────────────────────────────────
    // TB requires PUT /api/device with the FULL existing device object.
    // We must first GET the device, then send it back with the name changed.

    public void updateDevice(String tbDeviceId, String newName) {
        try {
            doUpdate(tbDeviceId, newName, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on updateDevice — refreshing token and retrying");
                doUpdate(tbDeviceId, newName, authService.forceRefresh());
                return;
            }
            log.error("TB updateDevice failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("ThingsBoard device update failed: " + e.getStatusCode());
        }
    }

    @SuppressWarnings("unchecked")
    private void doUpdate(String tbDeviceId, String newName, String token) {
        String baseUrl = authService.activeUrl();
        HttpHeaders headers = authHeaders(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        // PUT /api/device with nested id object as per ThingsBoard API spec
        Map<String, Object> idMap = new HashMap<>();
        idMap.put("entityType", "DEVICE");
        idMap.put("id", tbDeviceId);

        Map<String, Object> body = new HashMap<>();
        body.put("id", idMap);
        body.put("name", newName);
        body.put("type", "default");

        restTemplate.exchange(
            baseUrl + "/api/device",
            HttpMethod.PUT,
            new HttpEntity<>(body, headers),
            Map.class);
        log.info("TB device updated: id={} newName={}", tbDeviceId, newName);
    }

    // ── Delete device from ThingsBoard ───────────────────────────────────────

    public void deleteDevice(String tbDeviceId) {
        try {
            doDelete(tbDeviceId, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on deleteDevice — refreshing token and retrying");
                doDelete(tbDeviceId, authService.forceRefresh());
                return;
            }
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.warn("TB device {} not found during delete — skipping", tbDeviceId);
                return;
            }
            log.error("TB deleteDevice failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("ThingsBoard device deletion failed: " + e.getStatusCode());
        }
    }

    private void doDelete(String tbDeviceId, String token) {
        String url = authService.activeUrl() + "/api/device/" + tbDeviceId;
        restTemplate.exchange(url, HttpMethod.DELETE, new HttpEntity<>(authHeaders(token)), Void.class);
        log.info("TB device deleted: id={}", tbDeviceId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private HttpHeaders authHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-Authorization", "Bearer " + token);
        return h;
    }

    @SuppressWarnings("unchecked")
    private String extractDeviceId(Map body) {
        if (body == null) throw new RuntimeException("Empty response from ThingsBoard");
        Map<String, Object> idObj = (Map<String, Object>) body.get("id");
        if (idObj == null || !idObj.containsKey("id"))
            throw new RuntimeException("ThingsBoard response missing device id");
        return (String) idObj.get("id");
    }
}
