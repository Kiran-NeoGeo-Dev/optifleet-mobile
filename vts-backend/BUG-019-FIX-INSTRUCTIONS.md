# BUG-019 Fix: Phone Number & Username Normalization

## Problem Identified

The database constraint `chk_drivers_phone_number_10_digits` requires the `phone_number` field to be exactly 10 digits, but some drivers have invalid formats:

**Example of violation:**
```
Driver ID 44 (Srinivas):
- phone_number = "+91416354135645" (14 characters - violates constraint)
- username = NULL
```

Additionally, many drivers have `username = NULL` because they were created through the web interface without the username field being populated.

## Solution: Three-Step Process

Run these SQL scripts **in order** in your database:

### ✅ STEP 1: Fix phone_number field

**File:** `STEP1_FIX_PHONE_NUMBERS.sql`

**What it does:**
- Identifies drivers with invalid phone_number format
- Strips `+91` prefix from phone numbers like `+91416354135645` → `416354135645`
- Strips `91` prefix from phone numbers like `916300279982` → `6300279982`
- Ensures all phone_numbers are exactly 10 digits

**Why FIRST:** The constraint violation happens here. We must fix phone_number before fixing username.

**SQL:**
```sql
UPDATE public.drivers
SET phone_number = 
  CASE 
    WHEN phone_number LIKE '+91%' AND LENGTH(phone_number) = 13 THEN SUBSTRING(phone_number FROM 4)
    WHEN phone_number LIKE '91%' AND LENGTH(phone_number) = 12 AND phone_number NOT LIKE '+%' THEN SUBSTRING(phone_number FROM 3)
    ELSE phone_number
  END
WHERE LENGTH(phone_number) != 10 OR phone_number ~ '[^0-9]';
```

### ✅ STEP 2: Fix username field

**File:** `STEP2_FIX_USERNAMES.sql`

**What it does:**
- Populates NULL usernames with the 10-digit phone_number
- Normalizes any usernames with `+91` prefix
- Normalizes any usernames with `91` prefix (without +)

**SQL:**
```sql
-- Populate NULL usernames
UPDATE public.drivers
SET username = phone_number
WHERE username IS NULL AND phone_number IS NOT NULL;

-- Normalize prefixed usernames
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND username NOT LIKE '+%';
```

### ✅ STEP 3: Verify everything is fixed

**File:** `STEP3_VERIFY_ALL.sql`

**What it does:**
- Shows all drivers with their phone_number and username
- Validates that all phone_numbers are 10 digits and numeric
- Validates that all usernames are 10 digits and numeric
- Counts how many drivers are fully valid

**Expected Result:**
```
total_drivers: 25
valid_phones: 25
valid_usernames: 25
fully_valid: 25
```

## How to Execute

### Option 1: Using pgAdmin or psql

```bash
# Connect to your PostgreSQL database
psql -h 192.168.1.146 -U vts_user -d thingsboard_vts

# Run the scripts in order
\i STEP1_FIX_PHONE_NUMBERS.sql
\i STEP2_FIX_USERNAMES.sql
\i STEP3_VERIFY_ALL.sql
```

### Option 2: Using Database IDE

Copy and paste each SQL script into your IDE (pgAdmin, DBeaver, etc.) and execute.

### Option 3: Quick Copy-Paste

If you just want to run the fixes directly, use `MANUAL_FIX_DRIVERS.sql` which combines all steps.

## After Fixing the Database

### Restart the Application

```bash
cd vts-backend
mvn clean spring-boot:run
```

The application will:
1. Run Flyway migrations (which now know how to handle the normalized format)
2. Run the Java migration `DriverUsernameMigration` 
3. Start successfully

### Test OTP Authentication

Send an OTP request from the mobile app:

```
POST /api/driver-auth/send-otp
Body: { "mobileNumber": "8247285450" }
```

**Expected Result:** ✅ "OTP sent successfully"

NOT: ❌ "Driver not found"

## What Changed in Code

**Files Updated:**
- ✅ `V1__Normalize_driver_usernames.sql` - Flyway migration
- ✅ `DriverUsernameMigration.java` - Java migration with `fixPhoneNumbers()` method
- ✅ `DriverService.java` - Creates drivers with normalized username
- ✅ `DriverAuthController.java` - Debug logging for troubleshooting

## Troubleshooting

### If you still get "Driver not found"

1. Check the debug logs show all drivers
2. Verify phone_number and username are 10 digits
3. Restart the application
4. Try again

### If verification shows invalid drivers

1. Check if there are other phone number formats not handled
2. Example: Some phones might be 11 digits, or have spaces
3. Contact support with the specific phone_number format

## Data Examples - Before & After

### Example 1: Driver with +91 prefix
```
BEFORE:
- phone_number: "+918247285450" (14 chars)
- username: NULL

AFTER:
- phone_number: "8247285450" (10 chars) ✓
- username: "8247285450" (10 chars) ✓
```

### Example 2: Driver with 91 prefix
```
BEFORE:
- phone_number: "916300279982" (12 chars)
- username: NULL

AFTER:
- phone_number: "6300279982" (10 chars) ✓
- username: "6300279982" (10 chars) ✓
```

### Example 3: Driver already valid
```
BEFORE:
- phone_number: "9876543210" (10 chars)
- username: NULL

AFTER:
- phone_number: "9876543210" (10 chars) ✓
- username: "9876543210" (10 chars) ✓
```

## Future Prevention

Going forward, drivers created via the API will automatically have normalized phone numbers and usernames because:

1. **DriverService.createDriver()** - Normalizes phone number before storing as username
2. **DriverService.updateDriver()** - Maintains normalization on updates
3. **Database constraint** - `chk_drivers_phone_number_10_digits` enforces 10-digit format

No more issues! 🎉
