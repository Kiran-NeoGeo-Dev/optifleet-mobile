package com.vts.service;

import com.vts.utils.FernetEncryptionUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles ThingsBoard device lifecycle: create (+ make public), update, delete.
 * Automatically retries once with a fresh token on 401 Unauthorized.
 */
@Service
public class ThingsBoardDeviceService {

    private static final Logger log = LoggerFactory.getLogger(ThingsBoardDeviceService.class);

    private final ThingsBoardAuthService authService;
    private final FernetEncryptionUtil encryption;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ThingsBoardDeviceService(ThingsBoardAuthService authService, FernetEncryptionUtil encryption) {
        this.authService = authService;
        this.encryption = encryption;
    }

    // â”€â”€ Create device â†’ returns ThingsBoard device UUID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String createDevice(String deviceName) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", deviceName);
        body.put("type", "default");
        try {
            String token = authService.getJwtToken();
            String tbDeviceId = doCreate(body, token);
            makePublic(tbDeviceId, token);
            return tbDeviceId;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on createDevice â€” refreshing token and retrying");
                String token = authService.forceRefresh();
                String tbDeviceId = doCreate(body, token);
                makePublic(tbDeviceId, token);
                return tbDeviceId;
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

    private void makePublic(String tbDeviceId, String token) {
        try {
            String url = authService.activeUrl() + "/api/customer/public/device/" + tbDeviceId;
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(authHeaders(token)), Map.class);
            log.info("TB device marked as PUBLIC: id={}", tbDeviceId);
        } catch (Exception e) {
            log.error("TB makePublic failed for device {}: {}", tbDeviceId, e.getMessage());
        }
    }

    // â”€â”€ Fetch access token (credentialsId) for a TB device â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public String getAccessToken(String tbDeviceId) {
        try {
            return doGetAccessToken(tbDeviceId, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on getAccessToken â€” refreshing token and retrying");
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

    // â”€â”€ Update device name in ThingsBoard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // TB requires PUT /api/device with the FULL existing device object.
    // We must first GET the device, then send it back with the name changed.

    public void updateDevice(String tbDeviceId, String newName) {
        try {
            doUpdate(tbDeviceId, newName, authService.getJwtToken());
        } catch (RuntimeException e) {
            // Check if it's a 401 embedded in the message from doUpdate
            if (e.getMessage() != null && e.getMessage().contains("401")) {
                log.warn("TB 401 on updateDevice â€” refreshing token and retrying");
                doUpdate(tbDeviceId, newName, authService.forceRefresh());
                return;
            }
            log.error("TB updateDevice failed: {}", e.getMessage());
            throw e;
        }
    }

    private void doUpdate(String tbDeviceId, String newName, String token) {
        String baseUrl = authService.activeUrl();

        // Step 1: GET the full existing device object â€” auth header only
        HttpHeaders getHeaders = authHeaders(token);
        ResponseEntity<String> getRes;
        try {
            getRes = restTemplate.exchange(
                baseUrl + "/api/device/" + tbDeviceId,
                HttpMethod.GET,
                new HttpEntity<>(getHeaders),
                String.class);
        } catch (HttpClientErrorException e) {
            log.error("TB GET device failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("TB GET device failed: " + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        }

        if (getRes.getBody() == null)
            throw new RuntimeException("TB device not found for id=" + tbDeviceId);

        log.info("TB GET device OK: id={} bodyLength={}", tbDeviceId, getRes.getBody().length());

        // Step 2: Parse as ObjectNode, replace only name and label, PUT back
        try {
            ObjectNode deviceNode = (ObjectNode) objectMapper.readTree(getRes.getBody());
            deviceNode.put("name", newName);
            // label is intentionally NOT updated â€” keep existing value unchanged
            String putBody = objectMapper.writeValueAsString(deviceNode);

            HttpHeaders putHeaders = authHeaders(token);
            putHeaders.setContentType(MediaType.APPLICATION_JSON);
            // This TB version uses POST /api/device (with id in body) for both create and update
            ResponseEntity<String> putRes = restTemplate.exchange(
                baseUrl + "/api/device",
                HttpMethod.POST,
                new HttpEntity<>(putBody, putHeaders),
                String.class);
            log.info("TB device renamed OK: id={} newName={} status={}", tbDeviceId, newName, putRes.getStatusCode());
        } catch (HttpClientErrorException e) {
            log.error("TB PUT device failed [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("TB PUT device failed: " + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("TB rename JSON error: {}", e.getMessage());
            throw new RuntimeException("TB rename failed: " + e.getMessage(), e);
        }
    }

    // â”€â”€ Delete device from ThingsBoard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public void deleteDevice(String tbDeviceId) {
        try {
            doDelete(tbDeviceId, authService.getJwtToken());
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.warn("TB 401 on deleteDevice â€” refreshing token and retrying");
                doDelete(tbDeviceId, authService.forceRefresh());
                return;
            }
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.warn("TB device {} not found during delete â€” skipping", tbDeviceId);
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

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Association device rename helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Rename TB device to vehicle license plate. Called after a Vehicle-Device association is created/updated.
     */
    public void renameForAssociation(Integer vehicleId, Integer deviceId,
                                     com.vts.repository.VehicleRepository vehicleRepo,
                                     com.vts.repository.DeviceRepository deviceRepo,
                                     com.vts.repository.DeviceTbMappingRepository mappingRepo) {
        String licensePlate = vehicleRepo.findById(vehicleId.longValue())
                .orElseThrow(() -> new RuntimeException("Vehicle not found: " + vehicleId))
                .getLicensePlate();
        String deviceCode = deviceRepo.findById(deviceId.longValue())
                .orElseThrow(() -> new RuntimeException("Device not found: " + deviceId))
                .getDeviceId();
        String tbDeviceId = resolveTbDeviceId(deviceCode, mappingRepo);
        if (tbDeviceId == null) { log.warn("No TB device found for device code: {}", deviceCode); return; }
        updateDevice(tbDeviceId, licensePlate);
        log.info("TB device renamed to license plate: vehicleId={} deviceId={} name={}", vehicleId, deviceId, licensePlate);
    }

    /**
     * Rename TB device back to original Device ID. Called after a Vehicle-Device association is deleted.
     */
    public void renameToOriginal(Integer deviceId,
                                 com.vts.repository.DeviceRepository deviceRepo,
                                 com.vts.repository.DeviceTbMappingRepository mappingRepo) {
        String originalCode = deviceRepo.findById(deviceId.longValue())
                .orElseThrow(() -> new RuntimeException("Device not found: " + deviceId))
                .getDeviceId();
        String tbDeviceId = resolveTbDeviceId(originalCode, mappingRepo);
        if (tbDeviceId == null) { log.warn("No TB device found for device code: {}", originalCode); return; }
        updateDevice(tbDeviceId, originalCode);
        log.info("TB device renamed back to original: deviceId={} name={}", deviceId, originalCode);
    }

    private String resolveTbDeviceId(String deviceCode, com.vts.repository.DeviceTbMappingRepository mappingRepo) {
        return mappingRepo.findByDeviceId(deviceCode)
                .map(com.vts.entity.DeviceTbMapping::getThingsboardDeviceId)
                .orElse(null);
    }

    // â”€â”€ Task 3: Token Encryption/Decryption â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Decrypt an encrypted access token for ThingsBoard API communication.
     * Used when retrieving stored encrypted tokens from the database.
     * @param encryptedToken the encrypted token as stored in the database
     * @return the decrypted plain-text access token
     */
    public String decryptAccessToken(String encryptedToken) {
        if (encryptedToken == null || encryptedToken.isEmpty()) {
            throw new RuntimeException("Cannot decrypt null or empty token");
        }
        return encryption.decrypt(encryptedToken);
    }

    /**
     * Encrypt an access token before storing it in the database.
     * Used when saving tokens to ensure they're never stored in plain text.
     * @param plainToken the plain-text access token from ThingsBoard
     * @return the encrypted token safe for database storage
     */
    public String encryptAccessToken(String plainToken) {
        if (plainToken == null || plainToken.isEmpty()) {
            throw new RuntimeException("Cannot encrypt null or empty token");
        }
        return encryption.encrypt(plainToken);
    }
}
