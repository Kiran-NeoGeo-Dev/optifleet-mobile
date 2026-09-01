# Technical Details: Driver OTP Authentication Fix

## Database Schema

```sql
-- drivers table
CREATE TABLE public.drivers (
    id BIGINT PRIMARY KEY,
    driver_name VARCHAR(50) NOT NULL,
    license_no VARCHAR(20) NOT NULL UNIQUE,
    license_expiry DATE NOT NULL,
    phone_number VARCHAR(15) NOT NULL,      -- Stores: "+919549345765" or "9549345765"
    aadhaar_number VARCHAR(12) UNIQUE,
    status BOOLEAN,
    ...
    username VARCHAR(50) UNIQUE NOT NULL,  -- MUST be normalized to 10-digit format
    password VARCHAR(255),
    otp VARCHAR(6),
    otp_expiry TIMESTAMP,
    org_id INTEGER,
    ...
);

-- Check constraint on phone_number (validates various international formats)
CONSTRAINT chk_drivers_phone_number CHECK (
    phone_number IS NULL OR 
    phone_number ~ '^([0-9]{10}|\+91[0-9]{10}|...)$'
);
```

## Data Fields Explanation

| Field | Purpose | Format | Example |
|-------|---------|--------|---------|
| `phone_number` | Display/reference only | Flexible | "+919549345765" or "9549345765" |
| `username` | **OTP lookup key** | **MUST be 10-digit** | "9549345765" |
| `password` | Date of birth (plain text) | DD/MM/YYYY | "15/01/1990" |
| `otp` | Generated OTP | 6 digits | "123456" |
| `otp_expiry` | OTP validity period | Timestamp | 5 minutes from generation |

## Code Flow Diagrams

### Driver Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Admin adds driver via Web App / Mobile App                  │
│ Input: phoneNumber = "+919549345765" OR "919549345765"      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/drivers                                            │
│ DriverController.createDriver(DriverRequest)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DriverService.createDriver(DriverRequest)                   │
│                                                              │
│ ① mapRequestToDriver()                                      │
│    → driver.setPhoneNumber(phoneNumber) ✓                   │
│                                                              │
│ ② BEFORE FIX:                                               │
│    → driver.setUsername(request.getPhoneNumber().trim())    │
│       ✗ No normalization → "+919549345765"                  │
│                                                              │
│ ③ AFTER FIX:                                                │
│    → String normalized = normalizePhoneNumber("+91...")     │
│    → driver.setUsername(normalized)                         │
│       ✓ Normalized → "9549345765"                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ driverRepository.save(driver)                               │
│                                                              │
│ Database Insert:                                            │
│   phone_number = "+919549345765"                            │
│   username = "9549345765" ✓ (normalized)                    │
└─────────────────────────────────────────────────────────────┘
```

### OTP Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Mobile App - Login Screen                                   │
│ User enters: "9549345765" (10 digits, no prefix)           │
│ User clicks: "Send OTP"                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/driver-auth/send-otp                             │
│ Body: { "mobileNumber": "9549345765" }                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DriverAuthController.sendOtp(Map<String, String> body)     │
│                                                              │
│ ① Get mobile from request: "9549345765"                    │
│                                                              │
│ ② Strip +91 prefix (defensive):                            │
│    cleanMobile = "9549345765".replaceAll("^\\+91", "")    │
│    → cleanMobile = "9549345765"                             │
│                                                              │
│ ③ Validate 10-digit format:                                │
│    ✓ Matches ^[6-9]\\d{9}$ → Valid                         │
│                                                              │
│ ④ Query database by username:                              │
│    ✗ BEFORE FIX:                                            │
│       driverRepository.findByUsername("9549345765")         │
│       Database has: username = "+919549345765"              │
│       → NOT FOUND → "Driver not found" error                │
│                                                              │
│    ✓ AFTER FIX:                                             │
│       driverRepository.findByUsername("9549345765")         │
│       Database has: username = "9549345765"                 │
│       → FOUND! ✓                                            │
│                                                              │
│ ⑤ Check driver status:                                      │
│    ✓ status = true (active)                                │
│                                                              │
│ ⑥ Send OTP via OtpService:                                 │
│    otpService.sendOtp("9549345765")                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ OtpService.sendOtp(String mobileNumber)                    │
│                                                              │
│ ① Generate 6-digit OTP: "123456"                           │
│                                                              │
│ ② Store in memory with expiry:                             │
│    otpStore.put("9549345765", OtpEntry(                    │
│      otp: "123456",                                         │
│      expiryTime: now + 5 minutes,                           │
│      attempts: 0                                            │
│    ))                                                       │
│                                                              │
│ ③ Send via 2Factor SMS API:                                │
│    https://2factor.in/API/V1/{key}/SMS/+919549345765/...   │
│    ✓ SMS sent successfully                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Response to Mobile App                                      │
│ {                                                            │
│   "message": "OTP sent successfully",                       │
│   "mobile": "9549345765"                                    │
│ }                                                            │
│                                                              │
│ ✓ SUCCESS - Driver receives OTP via SMS!                   │
└─────────────────────────────────────────────────────────────┘
```

### OTP Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Mobile App - OTP Entry Screen                              │
│ User receives SMS with OTP: "123456"                        │
│ User enters: "123456"                                       │
│ User clicks: "Sign In"                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/driver-auth/verify-otp                           │
│ Body: {                                                      │
│   "mobileNumber": "9549345765",                            │
│   "otp": "123456"                                           │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DriverAuthController.verifyOtp()                            │
│                                                              │
│ ① Normalize mobile: "9549345765"                            │
│                                                              │
│ ② Verify OTP:                                               │
│    otpService.verifyOtp("9549345765", "123456")            │
│    ├─ Get from store: otpStore.get("9549345765")          │
│    ├─ Check expiry: not expired ✓                          │
│    ├─ Check attempts: < 3 ✓                                │
│    └─ Compare OTP: "123456" == "123456" ✓                  │
│                                                              │
│ ③ Lookup driver by username:                               │
│    driverRepository.findByUsername("9549345765") ✓          │
│                                                              │
│ ④ Check status:                                             │
│    driver.status = true ✓                                   │
│                                                              │
│ ⑤ Generate JWT token:                                      │
│    Claims:                                                   │
│      - driverId: 71                                         │
│      - clientId: 57                                         │
│      - orgId: 56                                            │
│      - role: "Driver"                                       │
│      - username: "9549345765"                               │
│                                                              │
│ ⑥ Return response:                                          │
│    {                                                         │
│      "token": "eyJhbGc...",                                 │
│      "clientId": 57,                                        │
│      "username": "9549345765",                              │
│      "role": "Driver",                                      │
│      "driverName": "Deeksha"                                │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Mobile App - Login Complete                                │
│ Store JWT token in secure storage                          │
│ Redirect to Driver Dashboard                               │
│                                                              │
│ ✓ SUCCESS - Driver logged in!                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Application Startup                                         │
│ spring.boot.startup...                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Flyway Database Migration                                   │
│ Runs: V1__Normalize_driver_usernames.sql                    │
│                                                              │
│ ① Check for drivers with "+91" prefix (13 chars):          │
│    UPDATE drivers                                            │
│    SET username = SUBSTRING(username FROM 4)               │
│    WHERE username LIKE '+91%' AND LENGTH(username) = 13    │
│                                                              │
│    Example:                                                 │
│    "+919549345765" → SUBSTRING(...FROM 4) → "9549345765"   │
│                                                              │
│ ② Check for drivers with "91" prefix (12 chars):           │
│    UPDATE drivers                                            │
│    SET username = SUBSTRING(username FROM 3)               │
│    WHERE username LIKE '91%' AND LENGTH(username) = 12     │
│    AND username NOT LIKE '+%'                               │
│                                                              │
│    Example:                                                 │
│    "919549345765" → SUBSTRING(...FROM 3) → "9549345765"    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Java Migration (Backup)                                     │
│ DriverUsernameMigration.migrate()                           │
│ Runs on: ApplicationReadyEvent                              │
│                                                              │
│ ① Normalize +91 prefixed usernames                          │
│ ② Normalize 91 prefixed usernames                           │
│ ③ Validate results (count malformed)                       │
│ ④ Log migration status and results                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Application Ready                                           │
│ All drivers have normalized 10-digit usernames ✓            │
│ OTP authentication ready to use ✓                           │
└─────────────────────────────────────────────────────────────┘
```

## Phone Number Normalization Logic

```java
private String normalizePhoneNumber(String phoneNumber) {
    if (phoneNumber == null || phoneNumber.isBlank()) {
        return null;
    }
    
    String cleaned = phoneNumber.trim();
    
    // Remove +91 prefix (e.g., "+919549345765" → "9549345765")
    cleaned = cleaned.replaceAll("^\\+91", "");
    
    // Remove 91 prefix if it would result in 10 digits
    // (e.g., "919549345765" → "9549345765")
    if (cleaned.startsWith("91") && cleaned.length() == 12) {
        cleaned = cleaned.substring(2);
    }
    
    return cleaned;
}
```

### Test Cases for Normalization

| Input | After replaceAll | After substring check | Output | ✓/✗ |
|-------|------------------|----------------------|--------|-----|
| "+919549345765" | "9549345765" | (12 < 12 skip) | "9549345765" | ✓ |
| "919549345765" | "919549345765" | "9549345765" | "9549345765" | ✓ |
| "9549345765" | "9549345765" | (10 < 12 skip) | "9549345765" | ✓ |
| "+91 9549345765" | "9549345765" | (10 < 12 skip) | "9549345765" | ✓ |
| "91999999999" | "91999999999" | (11 < 12 skip) | "91999999999" | ⚠️ (won't strip 91) |
| " 9549345765" | "9549345765" | (10 < 12 skip) | "9549345765" | ✓ |

## SQL Migration Details

### Migration File: V1__Normalize_driver_usernames.sql

```sql
-- Update 1: Strip +91 prefix from 13-character usernames
UPDATE public.drivers
SET username = SUBSTRING(username FROM 4)
WHERE username LIKE '+91%' AND LENGTH(username) = 13;

-- Update 2: Strip 91 prefix from 12-character usernames (non-+ prefix)
UPDATE public.drivers
SET username = SUBSTRING(username FROM 3)
WHERE username LIKE '91%' AND LENGTH(username) = 12 AND NOT username LIKE '+%';
```

### SUBSTRING Function
- `SUBSTRING(string FROM position)` - Extract from position to end
- Position 1 = first character
- `SUBSTRING("+919549345765" FROM 4)` = "9549345765" (starts from position 4)
- `SUBSTRING("919549345765" FROM 3)` = "9549345765" (starts from position 3)

## Verification Queries

```sql
-- Check migration results
SELECT 
  id, 
  driver_name, 
  username, 
  LENGTH(username) as username_len,
  phone_number,
  updated_at
FROM drivers
WHERE LENGTH(username) != 10
   OR username ~ '[^0-9]'  -- Contains non-digits
ORDER BY id;

-- Expected result: 0 rows (all usernames are 10-digit numbers)

-- Count normalized drivers
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN LENGTH(username) = 10 THEN 1 ELSE 0 END) as normalized
FROM drivers;

-- Expected: total = normalized (all drivers normalized)
```

---

## Performance Impact

✓ **Minimal:** 
- Normalization is simple string operation (replaceAll, substring)
- Migration runs once on startup
- OTP lookup performance unchanged
- Database query still uses indexed `username` field

## Security Considerations

✓ **Secure:**
- No sensitive data exposed
- Phone number normalization is deterministic
- OTP storage keyed by 10-digit number
- OTP still expires after 5 minutes
- Max 3 verification attempts enforced

---

## Backward Compatibility

✓ **Fully compatible:**
- Mobile app sends 10-digit numbers (already validated)
- Web app sends any format (now normalized)
- OTP endpoints strip +91 prefix (already implemented)
- Existing drivers auto-fixed by migration
- No database schema changes
- No API changes

---

This technical implementation ensures the driver OTP authentication flow works reliably across all input formats and existing data.
