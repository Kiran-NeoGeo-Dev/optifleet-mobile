# BUG-019: Driver OTP Authentication - Migration Troubleshooting Guide

## Problem

When drivers send OTP, the system returns "Driver not found" even though the driver exists in the database.

**Root Cause**: The driver usernames in the database still contain the +91 or 91 prefix, but the OTP lookup searches for 10-digit format without prefix.

## Automatic Fixes (Should Run on App Startup)

### 1. Flyway SQL Migration
- **File**: `src/main/resources/db/migration/V1__Normalize_driver_usernames.sql`
- **What it does**: Updates existing driver usernames to 10-digit format
- **When it runs**: When the Spring Boot application starts (if Flyway is enabled)

### 2. Java Migration (Backup)
- **File**: `src/main/java/com/vts/migration/DriverUsernameMigration.java`
- **What it does**: Runs after app startup to normalize usernames
- **When it runs**: On `ApplicationReadyEvent` after Flyway completes

### 3. Code Fixes
- **DriverService.createDriver()**: Now normalizes phone numbers before storing as username
- **DriverService.updateDriver()**: Maintains normalization consistency
- **DriverAuthController.sendOtp()**: Added debug logging to help diagnose issues

## How to Verify

### Check Application Logs

When the application starts, look for these log messages:

```
[Migration] ========================================
[Migration] Starting driver username normalization migration
[Migration] ========================================
[Migration] Updated X drivers with +91 prefix
[Migration] Updated Y drivers with 91 prefix (no +)
[Migration] Migration completed. Updated Z total drivers
[Migration] ========================================
```

If you see these logs, the migration ran successfully.

### Test OTP Flow

1. Send OTP request from mobile app:
   ```
   POST /api/driver-auth/send-otp
   Body: { "mobileNumber": "8247285450" }
   ```

2. Check the response. If driver is still not found, the app will log:
   ```
   [DriverAuth-DEBUG] ===== ALL DRIVERS IN DATABASE =====
   [DriverAuth-DEBUG] Total drivers in database: X
   [DriverAuth-DEBUG] Driver ID=1, Name=John, Username=+919549345765, PhoneNumber=+919549345765, Status=true
   [DriverAuth-DEBUG] ...more drivers...
   [DriverAuth-DEBUG] ===== END DEBUG LOG =====
   ```

This debug output shows what's actually in the database.

## Manual Fix (If Auto-Migration Fails)

If the migrations didn't run automatically, manually execute this SQL:

```sql
-- Update usernames with +91 prefix
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- Update usernames with 91 prefix (without +)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%';
```

Or use the provided script: `MANUAL_FIX_DRIVERS.sql`

## How New Drivers Are Created

When a new driver is created via the API:

1. **Input**: `phoneNumber` = "+919549345765"
2. **Processing**: `normalizePhoneNumber()` strips the prefix
3. **Stored**: `username` = "9549345765" (10 digits)
4. **OTP Lookup**: Searches for "9549345765" and finds it ✅

## Configuration Files Modified

- ✅ `src/main/java/com/vts/service/DriverService.java`
  - Added `normalizePhoneNumber()` method
  - Updated `createDriver()` to normalize
  - Updated `updateDriver()` to normalize

- ✅ `src/main/java/com/vts/controller/DriverAuthController.java`
  - Added debug logging method `logAllDriversForDebugging()`
  - Enhanced `sendOtp()` with debugging

- ✅ `src/main/resources/db/migration/V1__Normalize_driver_usernames.sql`
  - SQL migration for existing drivers

- ✅ `src/main/java/com/vts/migration/DriverUsernameMigration.java`
  - Java-based backup migration

- ✅ `src/main/resources/application.properties`
  - Enabled Flyway migrations
  - Configured migration location

- ✅ `pom.xml`
  - Added flyway-core dependency

## Next Steps

1. Rebuild and restart the application: `mvn clean spring-boot:run`
2. Check the logs for migration success messages
3. Send an OTP request
4. If it still fails, check the debug logs to see what usernames are in the database
5. If needed, manually run the SQL fix script

## Verification Checklist

- [ ] Application starts without errors
- [ ] Migration logs appear in console
- [ ] No SQL errors in logs
- [ ] Test OTP request returns success (not "Driver not found")
- [ ] Driver record in database has 10-digit username (e.g., "8247285450")

## Troubleshooting

### "Migration failed" error
- Check database connectivity
- Verify Flyway schema table exists: `flyway_schema_history`
- Check if there are conflicting migrations

### "Driver not found" still appears after migration
- Run the debug OTP request to see actual usernames in database
- Manually run the SQL fix script
- Restart the application after manual fix

### Debug Log Shows Non-10-Digit Usernames
- Username might be stored differently (e.g., only numbers, different format)
- Check the debug log output carefully
- May need custom SQL to fix specific cases
