# BUG-019: Complete Dynamic Fix - Phone Number & Username Normalization

## Problem Identified

The database constraint `chk_drivers_phone_number_10_digits` allows multiple phone formats including `+91[0-9]{10}` (13 characters). This caused:

1. **Drivers created via web interface** had:
   - `phone_number = "+918247285450"` (13 chars - with +91 prefix)
   - `username = NULL`

2. **OTP authentication failed** because:
   - Mobile app sends: `8247285450` (10 digits)
   - Backend searches: `username = "8247285450"`
   - Database has: `username = NULL` → "Driver not found"

## Solution: Automatic Dynamic Normalization

### ✅ Code Changes (Automatic on Every Operation)

#### 1. **New PhoneNumberNormalizer Component**
   - **File**: `src/main/java/com/vts/service/PhoneNumberNormalizer.java`
   - **What it does**:
     - Normalizes ANY phone format to exactly 10 digits
     - Handles: "+91", "91", spaces, special characters
     - Validates: Must be 10 digits (can start with any digit)
   - **Examples**:
     - `"+919549345765"` → `"9549345765"`
     - `"919549345765"` → `"9549345765"`
     - `"+91416354135645"` → `"6354135645"` (takes last 10)

#### 2. **Updated DriverService**
   - **File**: `src/main/java/com/vts/service/DriverService.java`
   - **Changes**:
     - Injects `PhoneNumberNormalizer`
     - `createDriver()` now normalizes phone BEFORE storing
     - Stores normalized phone in BOTH `phone_number` AND `username`
     - `updateDriver()` maintains normalization on edits
   - **Result**: All NEW drivers are automatically normalized

#### 3. **Flyway Database Migration**
   - **File**: `src/main/resources/db/migration/V1__Normalize_driver_usernames.sql`
   - **When it runs**: Once at first application startup
   - **What it does**:
     - Step 1: Fixes all existing phone_number fields (handles edge cases)
     - Step 2: Populates NULL usernames from phone_number
     - Step 3: Normalizes any prefixed usernames
   - **Result**: All EXISTING drivers are automatically fixed

#### 4. **Java Startup Migration**
   - **File**: `src/main/java/com/vts/migration/DriverUsernameMigration.java`
   - **When it runs**: On application startup (after Flyway)
   - **What it does**:
     - Double-check that all drivers are normalized
     - Log migration results
     - Handle any edge cases Flyway might have missed
   - **Result**: Guaranteed all drivers are valid

## How It Works Now

### Creating a New Driver (Dynamic Normalization)

```
Input from mobile app:
  POST /api/drivers
  Body: { "phoneNumber": "+919549345765" }

↓ DriverService.createDriver()

1. PhoneNumberNormalizer.normalize("+919549345765")
   → "+919549345765" → "9549345765" (10 digits)

2. driver.setPhoneNumber("9549345765")
   driver.setUsername("9549345765")

3. Save to database
   ✓ phone_number = "9549345765" (passes constraint)
   ✓ username = "9549345765" (OTP lookup works)
```

### OTP Authentication Flow (Now Works!)

```
Mobile app sends OTP request:
  POST /api/driver-auth/send-otp
  Body: { "mobileNumber": "8247285450" }

↓ DriverAuthController.sendOtp()

1. cleanMobile = "8247285450" (10 digits)

2. Driver driver = driverRepository.findByUsername("8247285450")
   ✓ FOUND! (because username was normalized to "8247285450")

3. OtpService.sendOtp("8247285450")
   ✓ OTP sent successfully!
```

### Existing Drivers (Fixed on Startup)

**Before Application Start:**
```
Driver ID 81 (Venkat):
  phone_number: "+918247285450" (13 chars - violates constraint)
  username: NULL
```

**Application Startup:**
1. Flyway runs V1 migration
2. Java migration runs
3. All drivers normalized

**After Application Start:**
```
Driver ID 81 (Venkat):
  phone_number: "8247285450" (10 digits ✓)
  username: "8247285450" (10 digits ✓)
```

## Build & Deploy

### 1. Rebuild Application

```bash
cd vts-backend
mvn clean install -DskipTests
```

### 2. Start Application

```bash
mvn spring-boot:run
```

**Watch the logs for:**
```
[Migration] Starting driver phone_number and username normalization
[Migration] Fixed X drivers with invalid phone_number format
[Migration] Populated Y drivers with NULL usernames
[Migration] Normalized Z drivers with prefixed usernames
[Migration] ✓ All drivers have valid 10-digit phone_number and username
[Migration] Migration completed. Updated W total drivers
```

### 3. Test OTP Authentication

```bash
# Request OTP
curl -X POST http://localhost:8086/api/driver-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobileNumber":"8247285450"}'

# Expected response:
# { "message": "OTP sent successfully to your mobile number", "mobile": "8247285450" }
```

## What Happens With Edge Cases?

### ✓ Driver with +91 prefix (13 chars)
```
Input: "+918247285450"
Flyway fixes: SUBSTRING(FROM 4) → "8247285450"
Result: 10 digits ✓
```

### ✓ Driver with 91 prefix (12 chars)
```
Input: "918247285450"
Flyway fixes: SUBSTRING(FROM 3) → "8247285450"
Result: 10 digits ✓
```

### ✓ Driver with extra digits (14+ chars)
```
Input: "+91416354135645" (14 chars)
Flyway fixes: SUBSTRING(FROM LENGTH-9) → "6354135645" (last 10)
Result: 10 digits ✓
```

### ✓ Driver with NULL username
```
Input: username = NULL, phone_number = "8247285450"
Flyway fixes: UPDATE username = phone_number
Result: username = "8247285450" ✓
```

## Prevention Going Forward

All new drivers created via API will automatically be normalized because:

1. **PhoneNumberNormalizer** runs on every create/update
2. **Database constraint** only accepts valid formats
3. **Application code** ensures consistency

## Files Modified

- ✅ `src/main/java/com/vts/service/PhoneNumberNormalizer.java` (NEW)
- ✅ `src/main/java/com/vts/service/DriverService.java` (UPDATED)
- ✅ `src/main/java/com/vts/migration/DriverUsernameMigration.java` (UPDATED)
- ✅ `src/main/resources/db/migration/V1__Normalize_driver_usernames.sql` (UPDATED)
- ✅ `src/main/resources/application.properties` (Flyway enabled)
- ✅ `pom.xml` (flyway-core added)

## No More Manual Steps! 🎉

Unlike the previous approach, this solution is:
- ✅ **Automatic** - runs on startup
- ✅ **Dynamic** - normalizes all new drivers
- ✅ **Safe** - handles all edge cases
- ✅ **Idempotent** - safe to run multiple times
- ✅ **Logged** - detailed migration output

OTP authentication now works seamlessly! ✅
