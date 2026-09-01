# Code Changes Summary: Issue #4 Fix

## Overview
This document summarizes all code changes made to fix the Driver OTP authentication issue.

---

## File 1: DriverService.java

**Location:** `vts-backend/src/main/java/com/vts/service/DriverService.java`

**Changes:** Added phone number normalization helper and updated driver creation/update methods

### Change 1: Add normalizePhoneNumber() Helper Method

**Location:** After `truncate()` method

```java
/**
 * Normalize Indian phone number to 10-digit format.
 * Handles:
 * - "+919876543210" → "9876543210"
 * - "919876543210" → "9876543210"
 * - "9876543210" → "9876543210"
 * 
 * This ensures the username field is always in a consistent format for OTP lookup.
 */
private String normalizePhoneNumber(String phoneNumber) {
    if (phoneNumber == null || phoneNumber.isBlank()) {
        return null;
    }
    String cleaned = phoneNumber.trim();
    // Remove +91 prefix if present
    cleaned = cleaned.replaceAll("^\\+91", "");
    // Remove 91 prefix if present (and number length would be correct after removal)
    if (cleaned.startsWith("91") && cleaned.length() == 12) {
        cleaned = cleaned.substring(2);
    }
    // Return the 10-digit number
    return cleaned;
}
```

### Change 2: Update createDriver() Method

**Before:**
```java
public Driver createDriver(DriverRequest request) {
    Driver driver = new Driver();
    mapRequestToDriver(request, driver);
    Long ownerId = authService.resolveResourceOwner(request.getClientId());
    driver.setClientId(ownerId);
    driver.setOrgId(resolveOrgId(ownerId));
    // username = mobile number, password = date of birth (DD/MM/YYYY) stored as plain text per requirement
    if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
        driver.setUsername(request.getPhoneNumber().trim());  // ❌ NO NORMALIZATION
    }
    if (request.getPassword() != null && !request.getPassword().isBlank()) {
        driver.setPassword(request.getPassword().trim());
    }
    driver.setCreatedAt(LocalDateTime.now());
    driver.setUpdatedAt(LocalDateTime.now());
    return driverRepository.save(driver);
}
```

**After:**
```java
public Driver createDriver(DriverRequest request) {
    Driver driver = new Driver();
    mapRequestToDriver(request, driver);
    Long ownerId = authService.resolveResourceOwner(request.getClientId());
    driver.setClientId(ownerId);
    driver.setOrgId(resolveOrgId(ownerId));
    // FIX BUG-019: Normalize phone number to 10-digit format before setting username
    // username = mobile number (10-digit), password = date of birth (DD/MM/YYYY) stored as plain text per requirement
    if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
        String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());
        driver.setUsername(normalizedPhone);  // ✓ NORMALIZED
        log.info("[DriverService] Created driver with normalized username: {} (original: {})", normalizedPhone, request.getPhoneNumber());
    }
    if (request.getPassword() != null && !request.getPassword().isBlank()) {
        driver.setPassword(request.getPassword().trim());
    }
    driver.setCreatedAt(LocalDateTime.now());
    driver.setUpdatedAt(LocalDateTime.now());
    return driverRepository.save(driver);
}
```

**Key Changes:**
- Added variable: `String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());`
- Changed: `driver.setUsername(normalizedPhone);` instead of `driver.setUsername(request.getPhoneNumber().trim());`
- Added: Logging for debugging

### Change 3: Update updateDriver() Method

**Before:**
```java
public Driver updateDriver(Long driverId, DriverRequest request) {
    Driver driver = getDriver(driverId);
    mapRequestToDriver(request, driver);
    if (request.getClientId() != null) {
        Long ownerId = authService.resolveResourceOwner(request.getClientId());
        driver.setClientId(ownerId);
        driver.setOrgId(resolveOrgId(ownerId));
    }
    // Keep username in sync with phone number, password = date of birth (DD/MM/YYYY) stored as plain text per requirement
    if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
        driver.setUsername(request.getPhoneNumber().trim());  // ❌ NO NORMALIZATION
    }
    if (request.getPassword() != null && !request.getPassword().isBlank()) {
        driver.setPassword(request.getPassword().trim());
    }
    driver.setUpdatedAt(LocalDateTime.now());
    return driverRepository.save(driver);
}
```

**After:**
```java
public Driver updateDriver(Long driverId, DriverRequest request) {
    Driver driver = getDriver(driverId);
    mapRequestToDriver(request, driver);
    if (request.getClientId() != null) {
        Long ownerId = authService.resolveResourceOwner(request.getClientId());
        driver.setClientId(ownerId);
        driver.setOrgId(resolveOrgId(ownerId));
    }
    // FIX BUG-019: Keep username in sync with phone number using normalized format
    // password = date of birth (DD/MM/YYYY) stored as plain text per requirement
    if (request.getPhoneNumber() != null && !request.getPhoneNumber().isBlank()) {
        String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());
        driver.setUsername(normalizedPhone);  // ✓ NORMALIZED
        log.info("[DriverService] Updated driver username to normalized format: {} (original: {})", normalizedPhone, request.getPhoneNumber());
    }
    if (request.getPassword() != null && !request.getPassword().isBlank()) {
        driver.setPassword(request.getPassword().trim());
    }
    driver.setUpdatedAt(LocalDateTime.now());
    return driverRepository.save(driver);
}
```

**Key Changes:**
- Added variable: `String normalizedPhone = normalizePhoneNumber(request.getPhoneNumber());`
- Changed: `driver.setUsername(normalizedPhone);` instead of `driver.setUsername(request.getPhoneNumber().trim());`
- Added: Logging for debugging

---

## File 2: DriverUsernameMigration.java (NEW)

**Location:** `vts-backend/src/main/java/com/vts/migration/DriverUsernameMigration.java` (NEW FILE)

**Purpose:** Java-based migration to normalize existing driver usernames on application startup

```java
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
```

---

## File 3: V1__Normalize_driver_usernames.sql (NEW)

**Location:** `vts-backend/src/main/resources/db/migration/V1__Normalize_driver_usernames.sql` (NEW FILE)

**Purpose:** Flyway SQL migration to normalize existing driver usernames

```sql
-- ============================================================================
-- Migration: V1__Normalize_driver_usernames.sql
-- Purpose: Fix BUG-019 - Normalize driver usernames to 10-digit format
-- Description:
--   Strips +91 and 91 prefixes from existing driver usernames to ensure 
--   consistency with OTP authentication flow. The OTP endpoints strip the 
--   +91 prefix before lookup, but usernames were stored with the prefix,
--   causing "Driver not found" errors during OTP authentication.
-- ============================================================================

-- Update usernames that have +91 prefix to 10-digit format
-- Example: "+919549345765" becomes "9549345765"
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- Update usernames that have 91 prefix (without +) to 10-digit format
-- Example: "919549345765" becomes "9549345765"
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND NOT username LIKE '+%';

-- Log the changes for debugging
-- SELECT 
--   id, 
--   driver_name, 
--   username, 
--   phone_number,
--   updated_at
-- FROM public.drivers 
-- WHERE LENGTH(username) != 10
-- ORDER BY id;
```

---

## File 4: pom.xml

**Location:** `vts-backend/pom.xml`

**Changes:** Added Flyway dependencies for database migrations

### Before:
```xml
        <!-- HTTP Client for MSG91 OTP -->
        <dependency>
            <groupId>org.apache.httpcomponents.client5</groupId>
            <artifactId>httpclient5</artifactId>
        </dependency>
    </dependencies>
```

### After:
```xml
        <!-- HTTP Client for MSG91 OTP -->
        <dependency>
            <groupId>org.apache.httpcomponents.client5</groupId>
            <artifactId>httpclient5</artifactId>
        </dependency>

        <!-- Flyway Database Migrations -->
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>
    </dependencies>
```

---

## File 5: application.properties

**Location:** `vts-backend/src/main/resources/application.properties`

**Changes:** Added Flyway configuration

### Before:
```properties
# ===============================
# JPA / Hibernate Configuration
# ===============================
#spring.jpa.hibernate.ddl-auto=validate
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
spring.jpa.properties.hibernate.jdbc.batch_size=10

# ===============================
# Server Configuration
# ===============================
```

### After:
```properties
# ===============================
# JPA / Hibernate Configuration
# ===============================
#spring.jpa.hibernate.ddl-auto=validate
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
spring.jpa.properties.hibernate.jdbc.batch_size=10

# ===============================
# Flyway Database Migration Configuration
# ===============================
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=false
spring.flyway.out-of-order=false

# ===============================
# Server Configuration
# ===============================
```

---

## Summary of Changes

| File | Type | Change | Impact |
|------|------|--------|--------|
| DriverService.java | MODIFIED | Added normalizePhoneNumber() helper | Normalizes phone numbers during driver create/update |
| DriverUsernameMigration.java | NEW | Java migration component | Normalizes existing drivers on startup |
| V1__Normalize_driver_usernames.sql | NEW | Flyway SQL migration | Normalizes existing drivers (runs before app) |
| pom.xml | MODIFIED | Added Flyway dependencies | Enables database migrations |
| application.properties | MODIFIED | Added Flyway config | Configures Flyway to run migrations |

**Total Files Changed:** 5 (2 new, 3 modified)
**Lines Added:** ~200 (code + migration)
**Breaking Changes:** None ✓
**Backward Compatible:** Yes ✓
**Database Schema Changes:** None (only data updates) ✓

---

## Testing & Verification

See `BUG-019-FIX-VERIFICATION.md` and `TECHNICAL_DETAILS.md` for:
- Manual testing procedures
- Test cases for phone number normalization
- SQL verification queries
- Deployment steps
- Troubleshooting guide

---

## How to Apply Changes

1. Pull the latest code with all changes
2. Run `mvn clean package` to compile
3. Deploy the new jar file
4. Database migrations will run automatically:
   - Flyway runs SQL migration first
   - Java migration runs after context startup
   - All existing drivers are normalized
5. Test OTP flow with existing and new drivers

---

Done! All changes are ready for production deployment.
