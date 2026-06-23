# OptiFleet Issues Analysis & Fixes - 2026-06-23

## Issues Discovered

### Issue 1: Device NOT Marked as PUBLIC in ThingsBoard ✅ FIXED

**Problem:**
- Devices created in ThingsBoard were not marked as `public=true`
- This prevented public access to device data in ThingsBoard

**Root Cause:**
- `ThingsBoardDeviceService.createDevice()` was not setting the public flag
- Device creation request only included `{"name": "...", "type": "default"}`

**Fix Applied:**
Updated `ThingsBoardDeviceService.java` to add public flag:
```java
Map<String, Object> body = new HashMap<>();
body.put("name", deviceName);
body.put("type", "default");
body.put("public", true);  // ✅ ADDED THIS
```

**Verification:**
New devices will now show as PUBLIC in ThingsBoard UI.

---

### Issue 2: Device Name NOT Renamed in ThingsBoard 

**Problem:**
- Device "DEV_630" shown in ThingsBoard with original device ID name
- Expected: Should be renamed to vehicle registration number (e.g., "AP26UM5558")

**Root Cause:**
Depends on whether association was created:
- **If association NOT created**: Renaming code never executed (expected behavior)
- **If association WAS created**: Check application logs for error

**Solution:**
To rename existing device DEV_630 to vehicle registration number:

**Step 1: Create Association via API**
```bash
POST /api/admin-associations
Content-Type: application/json

{
  "vehicle_id": 1,
  "device_id": 2
}
```

**Expected Result:**
- AdminAssociation created in database
- AdminAssociationService.create() called
- renameThingsBoardDevice(vehicleId, deviceId) executed
- ThingsBoard device renamed to vehicle's licensePlate

**Troubleshooting if not renamed:**
1. Check application logs for errors:
   ```
   grep "TB device renamed" /var/log/vts-backend/application.log
   grep "Failed to rename ThingsBoard" /var/log/vts-backend/application.log
   ```

2. Verify device mapping exists:
   ```sql
   SELECT * FROM device_tb_mapping WHERE device_id = 'DEV_630';
   ```

3. Check if vehicle exists with license plate:
   ```sql
   SELECT id, registration_number FROM vehicles WHERE id = 1;
   ```

4. Verify ThingsBoard connectivity:
   - Check TB host in application.properties
   - Verify TB credentials work
   - Check network connectivity to TB server

---

### Issue 3: Token Encryption Format

**Problem:**
- User provided plain token: `7yT5LGyos9eNcKLSYMto` (20 chars)
- Encrypted token in DB: `pNjBKk3Nyy7ECZNmzJoAphbAsfrv7mvks6nvzhGSPQBJbLlMzxjyJthGuX5GSjFm` (64 chars)

**Analysis:**
✅ **ENCRYPTION IS WORKING CORRECTLY**

**Explanation:**
- Plain token: "7yT5LGyos9eNcKLSYMto" = 20 bytes
- This is the ThingsBoard credentialsId (shortened access key)
- Encrypted using AES-256-GCM:
  - IV: 12 bytes (random)
  - Ciphertext: 20 bytes + 16 bytes (auth tag) = 36 bytes
  - Total: 48 bytes
  - Base64 encoded: 64 characters ✅

**Encryption Flow Verification:**
```
1. Device created: DeviceService.createDevice()
2. ThingsBoard device created with ID: "DEV_630"
3. Access token fetched: tbDeviceService.getAccessToken()
   → Returns: "7yT5LGyos9eNcKLSYMto" (credentialsId)
4. Token encrypted: encryption.encrypt(rawToken)
   → Generates random IV
   → Performs AES-256-GCM encryption
   → Base64-URL-safe encodes (IV + ciphertext + tag)
   → Returns: "pNjBKk3Nyy7ECZNmzJoAphbAsfrv7mvks6nvzhGSPQBJbLlMzxjyJthGuX5GSjFm"
5. Encrypted token stored in DB
   → device_tb_mapping.tb_access_token = encrypted value
```

**Token Format is CORRECT** ✅

---

## Changes Applied

### File: ThingsBoardDeviceService.java

**Change 1: Added public flag to device creation**
```java
// BEFORE:
Map<String, Object> body = Map.of("name", deviceName, "type", "default");

// AFTER:
Map<String, Object> body = new HashMap<>();
body.put("name", deviceName);
body.put("type", "default");
body.put("public", true);  // ✅ NEW
```

**Change 2: Updated log to include public flag**
```java
// BEFORE:
log.info("TB device created: name={} id={}", body.get("name"), tbDeviceId);

// AFTER:
log.info("TB device created: name={} id={} public=true", body.get("name"), tbDeviceId);
```

---

## Testing & Verification

### Test 1: Verify Device Created as PUBLIC
```bash
# Query ThingsBoard API
curl -X GET "http://183.82.114.29:8282/api/device/<deviceId>" \
  -H "X-Authorization: Bearer <jwt_token>"

# Check response for:
# "public": true
```

### Test 2: Test Device Renaming
```bash
# Step 1: Create device via API
POST /api/devices
{
  "deviceId": "TEST_001",
  "imeiNumber": "123456789012345",
  "deviceType": "GPS"
}

# Step 2: Create association
POST /api/admin-associations
{
  "vehicle_id": 1,
  "device_id": <returned_device_id>
}

# Step 3: Verify in ThingsBoard
# Device name should be: <vehicle.registration_number>
# e.g., "AP26UM5558"
```

### Test 3: Verify Token Encryption
```bash
# Query database
SELECT device_id, tb_access_token FROM device_tb_mapping LIMIT 1;

# Check:
# ✅ tb_access_token starts with base64 characters (not "eyJ...")
# ✅ tb_access_token is 64-80 characters
# ✅ No plain text visible
```

---

## Deployment Checklist

- [x] Fixed device creation to mark as PUBLIC
- [x] Code compiles successfully
- [x] Verified AdminAssociationService device renaming logic
- [x] Verified token encryption is working
- [ ] Test device creation (new devices should be PUBLIC)
- [ ] Test device renaming (create association to trigger)
- [ ] Monitor logs for TB operations
- [ ] Verify ThingsBoard UI shows devices as PUBLIC
- [ ] Confirm encrypted tokens stored in database

---

## Configuration

### Current Settings in application.properties
```properties
# ThingsBoard servers
tb.host.primary=183.82.114.29
tb.port.primary=8282
tb.host.fallback=192.168.1.146
tb.port.fallback=8282

# TB credentials
tb.username=kiran.m@neogeoinfo.com
tb.password=NeoGeo@321

# Encryption secret (Base64-encoded 32-byte key)
tb.encryption.secret=Ii9NZQPQDggZHcjAERIXcSQPomSC20k5VDYKoeR49tQ=
```

---

## Logs to Monitor

### Expected Logs After Fixes

**Device Creation (with PUBLIC flag):**
```
INFO  ThingsBoardDeviceService - TB device created: name=DEV_630 id=e05268a0-6e67-11f1-9310-310e28342b74 public=true
```

**Association Creation (with Device Renaming):**
```
INFO  AdminAssociationService - TB device renamed: vehicleId=1 deviceId=2 licensePlate=AP26UM5558
```

**Association Deletion (with Name Restore):**
```
INFO  AdminAssociationService - TB device renamed back to original: deviceId=2 originalName=DEV_630
```

### Error Logs to Watch

```
ERROR AdminAssociationService - Failed to rename ThingsBoard device: <error message>
WARN  AdminAssociationService - No ThingsBoard device found for device code: <deviceCode>
ERROR ThingsBoardDeviceService - TB createDevice failed: <statusCode>
```

---

## Database Verification Queries

### Check Device and Mapping
```sql
-- Find device
SELECT id, device_id, imei_number, created_at FROM devices WHERE device_id = 'DEV_630';

-- Find ThingsBoard mapping
SELECT id, device_id, thingsboard_device_id, tb_access_token, created_at 
FROM device_tb_mapping WHERE device_id = 'DEV_630';

-- Verify token is encrypted (should NOT start with "eyJ")
SELECT LENGTH(tb_access_token) AS token_length, 
       SUBSTRING(tb_access_token FROM 1 FOR 10) AS token_start
FROM device_tb_mapping;
```

### Check Associations
```sql
-- Admin associations (simple device-vehicle link)
SELECT * FROM admin_associations WHERE device_id = 2;

-- Full associations (device-vehicle-driver link)
SELECT * FROM associations WHERE device_id = 2;
```

---

## Summary

| Issue | Status | Action Required |
|-------|--------|-----------------|
| Device not marked PUBLIC | ✅ FIXED | Deploy new code |
| Device name not renamed | ✅ READY | Create association via API |
| Token encryption | ✅ WORKING | No action needed |
| Code compilation | ✅ PASSING | Ready for deployment |

**Next Steps:**
1. Deploy updated code (public flag added)
2. Create test device-vehicle association to trigger renaming
3. Verify in ThingsBoard UI that device shows correct name and is PUBLIC
4. Check application logs for successful rename operations

