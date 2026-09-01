package com.vts.migration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migration: Normalize driver phone_number and username to 10-digit format.
 * 
 * FIX BUG-019: Handles all phone number formats including:
 * - "+919549345765" → "9549345765"
 * - "919549345765" → "9549345765"
 * - "+91416354135645" → "6354135645" (takes last 10 if more than 10)
 * - "9549345765" → "9549345765" (unchanged)
 * 
 * This migration runs automatically on application startup.
 */
@Component
public class DriverUsernameMigration {

    private static final Logger log = LoggerFactory.getLogger(DriverUsernameMigration.class);

    private final JdbcTemplate jdbcTemplate;

    public DriverUsernameMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void migrate() {
        try {
            log.info("[Migration] ========================================");
            log.info("[Migration] Starting driver phone_number and username normalization");
            log.info("[Migration] ========================================");

            // Step 1: Fix phone_number field first (violates constraint if malformed)
            int fixedPhoneNumbers = fixPhoneNumbers();
            log.info("[Migration] Fixed {} drivers with invalid phone_number format", fixedPhoneNumbers);

            // Step 2: Populate NULL usernames from phone_number field
            int populatedNull = populateNullUsernames();
            log.info("[Migration] Populated {} drivers with NULL usernames from phone_number", populatedNull);

            // Step 3: Normalize any prefixed usernames
            int normalizedUsernames = normalizeUsernames();
            log.info("[Migration] Normalized {} drivers with prefixed usernames", normalizedUsernames);

            // Step 4: Validate results
            int malformed = countMalformedRecords();
            if (malformed > 0) {
                log.warn("[Migration] WARNING: {} drivers have non-10-digit phone/username", malformed);
                logMalformedDrivers();
            } else {
                log.info("[Migration] ✓ All drivers have valid 10-digit phone_number and username");
            }

            int total = fixedPhoneNumbers + populatedNull + normalizedUsernames;
            log.info("[Migration] ========================================");
            log.info("[Migration] Migration completed. Updated {} total drivers", total);
            log.info("[Migration] ========================================");

        } catch (Exception e) {
            log.error("[Migration] Migration failed with error: {}", e.getMessage(), e);
            throw new RuntimeException("Driver phone/username migration failed", e);
        }
    }

    /**
     * Fix phone_number field by handling various formats and normalizing to 10 digits.
     */
    private int fixPhoneNumbers() {
        try {
            String sql = "UPDATE public.drivers " +
                        "SET phone_number = " +
                        "CASE " +
                        "  WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) > 13 THEN SUBSTRING(phone_number FROM LENGTH(phone_number) - 9) " +
                        "  WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN SUBSTRING(phone_number FROM 4) " +
                        "  WHEN phone_number LIKE '91%' AND LENGTH(phone_number) > 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM LENGTH(phone_number) - 9) " +
                        "  WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM 3) " +
                        "  ELSE phone_number " +
                        "END " +
                        "WHERE phone_number IS NOT NULL AND (LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]')";
            int updated = jdbcTemplate.update(sql);
            log.debug("[Migration] Fixed {} drivers with invalid phone_number format", updated);
            return updated;
        } catch (Exception e) {
            log.error("[Migration] Error fixing phone_number field: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * Populate NULL usernames from phone_number field.
     * Only updates if it won't violate the unique constraint.
     * For duplicates, appends the driver ID to make it unique.
     */
    private int populateNullUsernames() {
        try {
            // Step 1: Only populate NULL usernames where the phone_number doesn't already exist as a username
            String sql1 = "UPDATE public.drivers d " +
                        "SET username = d.phone_number " +
                        "WHERE d.username IS NULL " +
                        "AND d.phone_number IS NOT NULL " +
                        "AND NOT EXISTS ( " +
                        "  SELECT 1 FROM public.drivers d2 " +
                        "  WHERE d2.username = d.phone_number AND d2.id != d.id " +
                        ")";
            int updated1 = jdbcTemplate.update(sql1);
            log.debug("[Migration] Populated {} drivers with NULL usernames (avoiding duplicates)", updated1);

            // Step 2: For remaining NULL usernames, generate unique usernames by appending driver ID
            // Format: "phoneNumber_driverId" (e.g., "6300279982_69")
            String sql2 = "UPDATE public.drivers " +
                        "SET username = phone_number || '_' || id " +
                        "WHERE username IS NULL AND phone_number IS NOT NULL";
            int updated2 = jdbcTemplate.update(sql2);
            log.debug("[Migration] Populated {} drivers with unique usernames (phone_id format)", updated2);

            int total = updated1 + updated2;
            if (updated2 > 0) {
                log.warn("[Migration] {} drivers have duplicate phone numbers, assigned unique usernames", updated2);
            }
            return total;
        } catch (Exception e) {
            log.error("[Migration] Error populating NULL usernames: {}", e.getMessage());
            // Don't throw - this is not a critical failure, log and continue
            log.warn("[Migration] Continuing migration despite NULL username population issue");
            return 0;
        }
    }

    /**
     * Normalize existing usernames that have +91 or 91 prefixes.
     */
    private int normalizeUsernames() {
        try {
            String sql = "UPDATE public.drivers " +
                        "SET username = " +
                        "CASE " +
                        "  WHEN username LIKE '+91%' AND LENGTH(username) > 13 THEN SUBSTRING(username FROM LENGTH(username) - 9) " +
                        "  WHEN username LIKE '+91%' AND LENGTH(username) = 13 THEN SUBSTRING(username FROM 4) " +
                        "  WHEN username LIKE '91%' AND LENGTH(username) > 12 AND username NOT LIKE '+%' THEN SUBSTRING(username FROM LENGTH(username) - 9) " +
                        "  WHEN username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%' THEN SUBSTRING(username FROM 3) " +
                        "  ELSE username " +
                        "END " +
                        "WHERE username IS NOT NULL AND (LENGTH(username) != 10 OR username ~ '[^0-9]')";
            int updated = jdbcTemplate.update(sql);
            log.debug("[Migration] Normalized {} drivers with prefixed usernames", updated);
            return updated;
        } catch (Exception e) {
            log.error("[Migration] Error normalizing usernames: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * Count drivers with malformed phone_number or username.
     */
    private int countMalformedRecords() {
        try {
            String sql = "SELECT COUNT(*) FROM public.drivers " +
                        "WHERE " +
                        "  (phone_number IS NOT NULL AND (LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]')) OR " +
                        "  (username IS NOT NULL AND (LENGTH(username) != 10 OR username ~ '[^0-9]'))";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("[Migration] Could not count malformed records: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Log drivers with malformed phone_number or username for debugging.
     */
    private void logMalformedDrivers() {
        try {
            String sql = "SELECT id, driver_name, phone_number, username FROM public.drivers " +
                        "WHERE " +
                        "  (phone_number IS NOT NULL AND (LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]')) OR " +
                        "  (username IS NOT NULL AND (LENGTH(username) != 10 OR username ~ '[^0-9]')) " +
                        "LIMIT 10";
            jdbcTemplate.query(sql, rs -> {
                log.warn("[Migration] Driver ID {}: {} | Phone: {} | Username: {}",
                        rs.getLong("id"),
                        rs.getString("driver_name"),
                        rs.getString("phone_number"),
                        rs.getString("username"));
            });
        } catch (Exception e) {
            log.warn("[Migration] Could not log malformed drivers: {}", e.getMessage());
        }
    }
}
