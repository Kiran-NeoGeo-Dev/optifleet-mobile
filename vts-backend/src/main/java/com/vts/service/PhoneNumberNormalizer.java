package com.vts.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Phone number normalization utility for Indian phone numbers.
 * 
 * Handles all international formats and normalizes to 10-digit Indian standard.
 * Examples:
 * - "+919549345765" → "9549345765"
 * - "919549345765" → "9549345765"
 * - "9549345765" → "9549345765"
 * - "+91 9549345765" → "9549345765"
 * - "+91416354135645" → "6354135645" (takes last 10 digits if more than 10)
 */
@Component
public class PhoneNumberNormalizer {

    private static final Logger log = LoggerFactory.getLogger(PhoneNumberNormalizer.class);

    /**
     * Normalize any international phone number to 10-digit Indian format.
     * Handles multiple formats and country codes.
     */
    public String normalize(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return null;
        }

        String cleaned = phoneNumber.trim();
        log.debug("[PhoneNorm] Input: {} (length: {})", cleaned, cleaned.length());

        // Remove all whitespace
        cleaned = cleaned.replaceAll("\\s+", "");

        // Remove all non-digit characters except leading +
        if (cleaned.startsWith("+")) {
            cleaned = "+" + cleaned.substring(1).replaceAll("[^0-9]", "");
        } else {
            cleaned = cleaned.replaceAll("[^0-9]", "");
        }

        // Handle Indian phone numbers with country codes
        if (cleaned.startsWith("+91")) {
            // +91 followed by digits
            cleaned = cleaned.substring(3); // Remove +91
        } else if (cleaned.startsWith("91") && cleaned.length() >= 12) {
            // 91 followed by 10+ digits (91XXXXXXXXXX...)
            cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith("+") && cleaned.length() > 1) {
            // Some other country code - try to extract 10 digits
            cleaned = cleaned.substring(1);
        }

        // Ensure exactly 10 digits by taking last 10 if longer
        if (cleaned.length() > 10) {
            log.warn("[PhoneNorm] More than 10 digits, taking last 10: {} → {}", cleaned, cleaned.substring(cleaned.length() - 10));
            cleaned = cleaned.substring(cleaned.length() - 10);
        } else if (cleaned.length() < 10) {
            log.warn("[PhoneNorm] Less than 10 digits: {}", cleaned);
            return cleaned; // Return as-is, validation will catch it
        }

        // Validate it's exactly 10 digits
        if (!isValid(cleaned)) {
            log.warn("[PhoneNorm] Result is not 10 numeric digits: {}", cleaned);
        }

        log.debug("[PhoneNorm] Normalized to: {}", cleaned);
        return cleaned;
    }

    /**
     * Validate if a string is exactly 10 digits (any starting digit).
     */
    public boolean isValid(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return false;
        }
        return phoneNumber.matches("^\\d{10}$");
    }

    /**
     * Validate if a string is a valid Indian phone number (10 digits starting with 6-9).
     */
    public boolean isValidIndian(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return false;
        }
        return phoneNumber.matches("^[6-9]\\d{9}$");
    }
}
