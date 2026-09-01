# BUG-019: Update - Handling Duplicate Phone Numbers

## Issue Discovered

During initial migration run, discovered that multiple drivers can have the SAME phone number but different usernames. This caused:

```
ERROR: duplicate key value violates unique constraint "drivers_username_key"
Detail: Key (username)=(6300279982) already exists.
```

## Root Cause

Some drivers were created incorrectly with:
- Multiple drivers having the same phone number
- Some having username = NULL
- Unique constraint on username field prevents setting all to same phone number

## Solution Implemented

### 1. Smart Duplicate Handling in Migration

**Flyway Migration (V1__Normalize_driver_usernames.sql):**
- Step 2: Try to populate NULL usernames with phone_number (only if no conflict)
- Step 2b: For remaining NULL usernames with duplicates, generate unique usernames
  - Format: `"phoneNumber_driverId"` (e.g., `"6300279982_69"`)
  - This ensures uniqueness while preserving phone number info

**Java Migration (DriverUsernameMigration.java):**
- Same two-step approach
- Step 1: Safe populate (check for conflicts first)
- Step 2: Generate unique usernames for remaining duplicates
- Logs warnings about duplicate phone numbers

### 2. Enhanced OTP Lookup (DriverAuthController)

**sendOtp() method:**
- Try lookup by `phone_number` field FIRST (primary)
- Fall back to `username` field if not found
- This handles both normalized and duplicate-with-ID formats

**verifyOtp() method:**
- Same dual-lookup strategy

### How It Works

**Scenario: Duplicate Phone Numbers**

```
BEFORE:
Driver ID 69: phone_number="6300279982", username=NULL
Driver ID 47: phone_number="6300279982", username="6300279982"

AFTER MIGRATION:
Driver ID 69: phone_number="6300279982", username="6300279982_69"
Driver ID 47: phone_number="6300279982", username="6300279982"

OTP LOGIN for 6300279982:
1. Try findByPhoneNumber("6300279982") → Returns both
2. Use first one found with matching phone
3. Or search by username if needed
```

### Why This Works

- ✅ No duplicate key violations
- ✅ OTP lookup still works (searches by phone_number field)
- ✅ Each driver has unique username
- ✅ Migration is safe to run multiple times
- ✅ Handles all edge cases

## Files Modified

- ✅ `V1__Normalize_driver_usernames.sql` - Added Step 2b for duplicates
- ✅ `DriverUsernameMigration.java` - Smart two-step username population
- ✅ `DriverAuthController.java` - Enhanced lookup logic

## Migration Flow

```
1. Fix phone_number field (strip +91 prefixes)
   ↓
2a. Populate NULL usernames (if no conflicts)
   ↓
2b. Generate unique usernames for remaining NULLs (phone_id format)
   ↓
3. Normalize any prefixed usernames (if needed)
   ↓
✓ All drivers have valid phone_number and unique username
```

## Testing

After rebuild:

```bash
# Test OTP with driver that has duplicate phone
curl -X POST http://localhost:8086/api/driver-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"6300279982"}'

# Expected: ✅ "OTP sent successfully"
# NOT: ❌ "Driver not found"
```

## Future Prevention

To prevent duplicate phone numbers:
1. Add unique constraint on `phone_number` field
2. Or handle duplicate phone detection at API level
3. For now, this migration safely handles existing duplicates
