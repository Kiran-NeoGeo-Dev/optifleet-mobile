package com.vts.migration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migration: Normalize driver usernames to 10-digit format.
 * 
 * FIX BUG-019: Ensures all driver usernames are stored in 10-digit format
 * (without +91 or 91 prefix) to match the OTP authentication flow expectations.
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
            log.info("[Migration] Starting driver username normalization migration");
            log.info("[Migration] ========================================");

            // Step 1: Normalize usernames with +91 prefix (13 chars total)
            int updated1 = normalizeWithPrefix("+91");
            log.info("[Migration] Updated {} drivers with +91 prefix", updated1);

            // Step 2: Normalize usernames with 91 prefix (12 chars total, no +)
            int updated2 = normalizeWithPrefix("91");
            log.info("[Migration] Updated {} drivers with 91 prefix (no +)", updated2);

            // Step 3: Validate results
            int malformed = countMalformedUsernames();
            if (malformed > 0) {
                log.warn("[Migration] WARNING: {} drivers have non-10-digit usernames", malformed);
                logMalformedDrivers();
            }

            int total = updated1 + updated2;
            log.info("[Migration] ========================================");
            log.info("[Migration] Migration completed. Updated {} total drivers", total);
            log.info("[Migration] ========================================");

        } catch (Exception e) {
            log.error("[Migration] Migration failed with error: {}", e.getMessage(), e);
            throw new RuntimeException("Driver username migration failed", e);
        }
    }

    /**
     * Normalize usernames that start with the given prefix.
     */
    private int normalizeWithPrefix(String prefix) {
        try {
            if ("+91".equals(prefix)) {
                // Username format: "+919876543210" (13 chars) → "9876543210" (10 chars)
                String sql = "UPDATE public.drivers SET username = SUBSTRING(username FROM 4) " +
                            "WHERE username LIKE '+91%' AND LENGTH(username) = 13";
                int updated = jdbcTemplate.update(sql);
                log.debug("[Migration] Normalized {} drivers with +91 prefix", updated);
                return updated;
            } else if ("91".equals(prefix)) {
                // Username format: "919876543210" (12 chars) → "9876543210" (10 chars)
                String sql = "UPDATE public.drivers SET username = SUBSTRING(username FROM 3) " +
                            "WHERE username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%'";
                int updated = jdbcTemplate.update(sql);
                log.debug("[Migration] Normalized {} drivers with 91 prefix", updated);
                return updated;
            }
            return 0;
        } catch (Exception e) {
            log.error("[Migration] Error normalizing usernames with prefix {}: {}", prefix, e.getMessage());
            throw e;
        }
    }

    /**
     * Count drivers with non-10-digit usernames.
     */
    private int countMalformedUsernames() {
        try {
            String sql = "SELECT COUNT(*) FROM public.drivers WHERE LENGTH(username) != 10 OR username ~ '[^0-9]'";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("[Migration] Could not count malformed usernames: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Log drivers with non-10-digit usernames for debugging.
     */
    private void logMalformedDrivers() {
        try {
            String sql = "SELECT id, driver_name, username, phone_number FROM public.drivers " +
                        "WHERE LENGTH(username) != 10 OR username ~ '[^0-9]' " +
                        "LIMIT 10";
            jdbcTemplate.query(sql, rs -> {
                log.warn("[Migration] Driver ID {}: {} | Username: {} | Phone: {}",
                        rs.getLong("id"),
                        rs.getString("driver_name"),
                        rs.getString("username"),
                        rs.getString("phone_number"));
            });
        } catch (Exception e) {
            log.warn("[Migration] Could not log malformed drivers: {}", e.getMessage());
        }
    }
}
