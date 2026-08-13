package com.vts.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * OTP Service using 2Factor API for sending SMS OTPs.
 * Stores OTPs in-memory with 5-minute expiry.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    @Value("${twofactor.api.key:d76b1852-8f13-11f1-908b-0200cd936042}")
    private String twoFactorApiKey;

    @Value("${twofactor.sms.template:otp}")
    private String twoFactorSmsTemplate;

    private final Map<String, OtpEntry> otpStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public OtpService() {
        // Clean expired OTPs every minute
        scheduler.scheduleAtFixedRate(this::cleanExpiredOtps, 1, 1, TimeUnit.MINUTES);
    }

    /**
     * Generate and send OTP via 2Factor SMS.
     * Returns true if OTP was sent successfully, false otherwise.
     */
    public boolean sendOtp(String mobileNumber) {
        if (mobileNumber == null || mobileNumber.isBlank()) {
            log.warn("[OTP] Invalid mobile number: {}", mobileNumber);
            return false;
        }

        String cleanMobile = mobileNumber.trim().replaceAll("^\\+91", "");
        
        // Validate 10-digit Indian mobile number
        if (!cleanMobile.matches("^[6-9]\\d{9}$")) {
            log.warn("[OTP] Invalid Indian mobile number format: {}", cleanMobile);
            return false;
        }

        log.info("[OTP] Generating OTP for mobile: {}", maskMobile(cleanMobile));

        // Generate 6-digit OTP
        String otp = String.format("%06d", (int) (Math.random() * 1000000));
        
        log.debug("[OTP] Generated OTP (first 2 digits): {}****, length: {}", otp.substring(0, 2), otp.length());
        
        // Store OTP with 5-minute expiry
        long expiryTime = System.currentTimeMillis() + (5 * 60 * 1000);
        otpStore.put(cleanMobile, new OtpEntry(otp, expiryTime, 0));

        log.info("[OTP] OTP stored in memory, attempting to send via 2Factor...");

        // Send OTP via 2Factor
        boolean sent = send2FactorSms(cleanMobile, otp);
        
        if (sent) {
            log.info("[OTP] ✓ OTP sent successfully to {}", maskMobile(cleanMobile));
        } else {
            log.error("[OTP] ✗ Failed to send OTP to {}", maskMobile(cleanMobile));
            // Remove from store if send failed
            otpStore.remove(cleanMobile);
        }

        return sent;
    }

    /**
     * Verify OTP for the given mobile number.
     * Returns true if OTP is valid and not expired, false otherwise.
     * Limits verification attempts to 3 per OTP.
     */
    public boolean verifyOtp(String mobileNumber, String otp) {
        if (mobileNumber == null || otp == null) {
            return false;
        }

        String cleanMobile = mobileNumber.trim().replaceAll("^\\+91", "");
        OtpEntry entry = otpStore.get(cleanMobile);

        if (entry == null) {
            log.warn("[OTP] No OTP found for mobile: {}", maskMobile(cleanMobile));
            return false;
        }

        // Check if OTP has expired
        if (System.currentTimeMillis() > entry.expiryTime) {
            otpStore.remove(cleanMobile);
            log.warn("[OTP] OTP expired for mobile: {}", maskMobile(cleanMobile));
            return false;
        }

        // Check attempt limit (max 3 attempts)
        if (entry.attempts >= 3) {
            otpStore.remove(cleanMobile);
            log.warn("[OTP] Max verification attempts exceeded for mobile: {}", maskMobile(cleanMobile));
            return false;
        }

        // Increment attempt count
        entry.attempts++;

        // Verify OTP
        if (entry.otp.equals(otp.trim())) {
            otpStore.remove(cleanMobile);
            log.info("[OTP] OTP verified successfully for mobile: {}", maskMobile(cleanMobile));
            return true;
        }

        log.warn("[OTP] Invalid OTP for mobile: {} (attempt {}/3)", maskMobile(cleanMobile), entry.attempts);
        return false;
    }

    /**
     * Send SMS via 2Factor API using OFFICIAL LATEST API DOCUMENTATION.
     * 
     * Official API: https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}/{otp_template_name}
     * Phone format: Must be international format (+91XXXXXXXXXX)
     * Template: Required parameter
     * 
     * NOTE: Using Manual OTP (not AUTOGEN) because we generate our own OTP for verification control.
     */
    private boolean send2FactorSms(String mobileNumber, String otp) {
        String templateName = twoFactorSmsTemplate;
        
        log.info("[2Factor] ========================================");
        log.info("[2Factor] Sending SMS OTP using OFFICIAL 2Factor API");
        log.info("[2Factor] Mobile: {}, Template: {}, OTP: {}****", maskMobile(mobileNumber), templateName, otp.substring(0, 2));
        log.info("[2Factor] ========================================");
        
        // Convert to international format: +91XXXXXXXXXX
        String internationalPhone = "+91" + mobileNumber;
        log.info("[2Factor] Phone format: {} → {}", mobileNumber, internationalPhone);
        
        // Approach 1: Manual OTP with template and international format (RECOMMENDED)
        log.info("[2Factor] Trying Manual OTP with +91 format...");
        boolean result = tryManualOtpWithTemplate(internationalPhone, otp, templateName);
        if (result) return true;
        
        // Approach 2: Manual OTP with template (without +91)
        log.warn("[2Factor] +91 format failed, trying without +91 prefix...");
        result = tryManualOtpWithTemplate(mobileNumber, otp, templateName);
        if (result) return true;
        
        // Approach 3: Manual OTP without template (with +91)
        log.warn("[2Factor] With template failed, trying without template (+91 format)...");
        result = tryManualOtpWithoutTemplate(internationalPhone, otp);
        if (result) return true;
        
        // Approach 4: Manual OTP without template (no +91)
        log.warn("[2Factor] Trying without template and without +91...");
        result = tryManualOtpWithoutTemplate(mobileNumber, otp);
        if (result) return true;
        
        log.error("[2Factor] ========================================");
        log.error("[2Factor] ALL MANUAL OTP APPROACHES FAILED!");
        log.error("[2Factor] Tried:");
        log.error("[2Factor]   1. Manual OTP with template (+91 format)");
        log.error("[2Factor]   2. Manual OTP with template (no +91)");
        log.error("[2Factor]   3. Manual OTP without template (+91 format)");
        log.error("[2Factor]   4. Manual OTP without template (no +91)");
        log.error("[2Factor] ========================================");
        log.error("[2Factor] This is a 2Factor account configuration issue.");
        log.error("[2Factor] Template '{}' may not be approved or SMS may not be enabled.", templateName);
        log.error("[2Factor] Contact: support@2factor.in");
        log.error("[2Factor] ========================================");
        
        return false;
    }
    
    /**
     * Official API: Manual OTP with Template
     * GET https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}/{otp_template_name}
     */
    private boolean tryManualOtpWithTemplate(String phoneNumber, String otp, String templateName) {
        try {
            String url = String.format(
                "https://2factor.in/API/V1/%s/SMS/%s/%s/%s",
                twoFactorApiKey,
                phoneNumber,
                otp,
                templateName
            );
            
            log.info("[2Factor] [Manual OTP+Template] URL: https://2factor.in/API/V1/****/SMS/{}/{}****/{}", 
                phoneNumber, otp.substring(0, 2), templateName);
            
            return executeRequest(url, "Manual OTP with Template");
        } catch (Exception e) {
            log.error("[2Factor] [Manual OTP+Template] Exception: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * Manual OTP without Template (fallback)
     * GET https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}
     */
    private boolean tryManualOtpWithoutTemplate(String phoneNumber, String otp) {
        try {
            String url = String.format(
                "https://2factor.in/API/V1/%s/SMS/%s/%s",
                twoFactorApiKey,
                phoneNumber,
                otp
            );
            
            log.info("[2Factor] [Manual OTP-Template] URL: https://2factor.in/API/V1/****/SMS/{}/{}****", 
                phoneNumber, otp.substring(0, 2));
            
            return executeRequest(url, "Manual OTP without Template");
        } catch (Exception e) {
            log.error("[2Factor] [Manual OTP-Template] Exception: {}", e.getMessage());
            return false;
        }
    }
    
    private boolean executeRequest(String url, String approachName) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();

            log.info("[2Factor] [{}] Response Status: {}", approachName, response.statusCode());
            log.info("[2Factor] [{}] Response Body: {}", approachName, body);

            if (response.statusCode() == 200 && body != null && body.contains("\"Status\":\"Success\"")) {
                log.info("[2Factor] ✓ SUCCESS with approach: {}", approachName);
                return true;
            } else {
                log.warn("[2Factor] ✗ FAILED with approach: {}", approachName);
                return false;
            }
        } catch (IOException e) {
            log.error("[2Factor] [{}] IOException: {}", approachName, e.getMessage());
            return false;
        } catch (InterruptedException e) {
            log.error("[2Factor] [{}] InterruptedException: {}", approachName, e.getMessage());
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            log.error("[2Factor] [{}] Exception: {}", approachName, e.getMessage());
            return false;
        }
    }

    /**
     * Clean expired OTPs from the store.
     */
    private void cleanExpiredOtps() {
        long now = System.currentTimeMillis();
        otpStore.entrySet().removeIf(entry -> entry.getValue().expiryTime < now);
    }

    /**
     * Mask mobile number for logging (show only last 4 digits).
     */
    private String maskMobile(String mobile) {
        if (mobile == null || mobile.length() < 4) return "****";
        return "******" + mobile.substring(mobile.length() - 4);
    }

    /**
     * OTP entry with expiry time and attempt count.
     */
    private static class OtpEntry {
        final String otp;
        final long expiryTime;
        int attempts;

        OtpEntry(String otp, long expiryTime, int attempts) {
            this.otp = otp;
            this.expiryTime = expiryTime;
            this.attempts = attempts;
        }
    }
}
