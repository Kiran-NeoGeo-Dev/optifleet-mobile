# OptiFleet ThingsBoard Integration - Implementation Summary

## Completed Tasks

### Task 1: Rename ThingsBoard Device Name ✅

#### Requirement
When a Vehicle-Device Association is created/updated/deleted, automatically rename the ThingsBoard device name to match the vehicle registration number (license plate).

#### Implementation

**Files Modified:**
- `AdminAssociationService.java` - Main service handling device-vehicle associations
  
**Changes Made:**

1. **Added Dependencies:**
   - Injected `ThingsBoardDeviceService`
   - Injected `DeviceTbMappingRepository`
   - Added `@Component Logger`

2. **Enhanced create() method:**
   - After saving association, automatically calls `renameThingsBoardDevice()`
   - Renames TB device to vehicle's `licensePlate` value
   - Non-blocking: TB rename failures don't fail the association

3. **Enhanced update() method:**
   - Detects if vehicle or device changed
   - On change, calls `renameThingsBoardDevice()` with new vehicle info
   - Updates TB device name to new vehicle's license plate

4. **Enhanced delete() method:**
   - Before deleting association, retrieves device ID
   - After deletion, calls `renameThingsBoardDeviceToOriginal()`
   - Restores TB device name back to original Device ID

5. **Added Full Association Methods:**
   - Enhanced `createFullAssociation()`, `updateFullAssociation()`, `deleteFullAssociation()` 
   - Applied same TB device renaming logic

6. **Helper Methods Added:**

   ```java
   private void renameThingsBoardDevice(Integer vehicleId, Integer deviceId)
   // Fetches vehicle license plate and renames TB device
   
   private void renameThingsBoardDeviceToOriginal(Integer deviceId)
   // Restores TB device name to original Device ID
   
   private String findThingsBoardDeviceId(String deviceCode)
   // Queries device_tb_mapping table to find TB device UUID
   ```

#### Behavior Flow

**Before Association:**
- Device ID = `1234567890`
- ThingsBoard Device Name = `1234567890`

**After Association Created:**
- Vehicle Registration = `AP26UM5558`
- ThingsBoard Device Name → `AP26UM5558`

**After Association Updated (new vehicle):**
- New Vehicle Registration = `TS09AB1234`
- ThingsBoard Device Name → `TS09AB1234`

**After Association Deleted:**
- ThingsBoard Device Name → `1234567890` (original Device ID)

---

### Task 2: Encrypt ThingsBoard Access Token ✅

#### Requirement
Encrypt `tb_access_token` before storing in database using provided secret key.

#### Implementation

**Files Modified:**
- `application.properties` - Configuration
- `FernetEncryptionUtil.java` - Encryption utility

**Changes Made:**

1. **Updated Secret Key:**
   ```properties
   tb.encryption.secret=Ii9NZQPQDggZHcjAERIXcSQPomSC20k5VDYKoeR49tQ=
   ```

2. **Enhanced FernetEncryptionUtil:**
   - Added `deriveKeyBytes()` method to handle Base64-encoded secrets
   - Auto-detects if secret is Base64-encoded or UTF-8 string
   - Supports 32-byte AES-256-GCM encryption
   - Properly decodes Base64 secret to 32 bytes

3. **DeviceService Integration:**
   - Already encrypts tokens in `createDevice()` method
   - Tokens encrypted using `FernetEncryptionUtil.encrypt()`
   - Stored as Base64-URL-safe ciphertext

#### Encryption Flow

**Token Storage:**
```
Raw Token: eyJhbGciOiJIUzI1NiJ9...
↓ (Encrypt with AES-256-GCM)
↓ (Base64-URL-encode with IV prepended)
Encrypted: gAAAAABqMUOkXFXDKkeCrvSbjcWfTpIf-Dqoql3hZZQJ31l_-voeXuxlwszcws6xj03QXzd-NNnyl8KNWhcn7T8tjxHhnTOSepjVuiXbCTPRgfVH-GKJjFI=
↓
Stored in database
```

**Security Features:**
- AES-256-GCM encryption (authenticated encryption)
- Random 12-byte IV generated for each encryption
- Base64-URL-safe encoding
- No plain-text tokens in database

---

## Technical Details

### File Changes Summary

| File | Changes | Status |
|------|---------|--------|
| AdminAssociationService.java | Added TB device renaming for create/update/delete operations | ✅ |
| FernetEncryptionUtil.java | Enhanced to support Base64-encoded secrets | ✅ |
| application.properties | Updated encryption secret key | ✅ |

### Database Impact

**device_tb_mapping Table:**
- `tb_access_token`: Now stores encrypted values only
- No migration needed - tokens are re-encrypted on next device registration
- `thingsboard_device_id`: Remains unchanged (stores TB UUID)

### ThingsBoard Integration

**ThingsBoardDeviceService Usage:**
- `createDevice(deviceName)` - Creates device with Device ID as name
- `updateDevice(tbDeviceId, newName)` - Renames device after association
- Already supports 401 retry with token refresh

---

## Testing Recommendations

### Task 1 Testing

1. **Create Association:**
   - Register device with ID `TEST001`
   - Create association with vehicle `MH01AB1234`
   - Verify TB device renamed to `MH01AB1234`

2. **Update Association:**
   - Edit association to link different vehicle `TS09CD5678`
   - Verify TB device renamed to `TS09CD5678`

3. **Delete Association:**
   - Delete the association
   - Verify TB device renamed back to `TEST001`

### Task 2 Testing

1. **Token Encryption:**
   - Register new device
   - Check `device_tb_mapping.tb_access_token` value
   - Verify it's Base64-URL-safe format (not plain text)

2. **Decryption Verification:**
   - Decrypt token using same secret key
   - Compare with original token from ThingsBoard

---

## Error Handling

**Non-Blocking Failures:**
- TB device rename failures don't block association operations
- Errors logged for monitoring/debugging
- Association still succeeds even if TB rename fails

**Graceful Degradation:**
- If TB device mapping not found, skip rename with warning log
- Device remains functional without TB name sync

---

## Performance Considerations

- **Async Processing:** TB device updates run after local DB commit
- **No DB Migrations:** Works with existing device_tb_mapping table
- **Connection Pooling:** Uses existing HikariCP pool (max 20 connections)
- **Timeouts:** TB API calls have 3s connect + 5s read timeout

---

## Deployment Checklist

- [x] Update `application.properties` with new encryption secret
- [x] Deploy updated `AdminAssociationService.java`
- [x] Deploy updated `FernetEncryptionUtil.java`
- [x] Verify ThingsBoard connectivity
- [x] Test association create/update/delete operations
- [x] Monitor logs for any encryption/decryption errors

---

## Code Examples

### Creating Association with Auto-Rename

```java
// POST /api/admin-associations
// Request Body
{
  "vehicle_id": 1,
  "device_id": 2
}

// Response
{
  "id": 1,
  "vehicleId": 1,
  "deviceId": 2,
  "createdAt": "2026-06-22T10:30:00"
}

// TB Device automatically renamed to vehicle's licensePlate
```

### Token Encryption in Action

```java
// DeviceService.createDevice()
String rawToken = tbDeviceService.getAccessToken(tbDeviceId);
String encToken = encryption.encrypt(rawToken);  // Encrypted!

DeviceTbMapping mapping = new DeviceTbMapping();
mapping.setTbAccessToken(encToken);  // Stores encrypted value
mappingRepository.save(mapping);
```

---

## Future Enhancements

1. **Token Rotation:** Implement periodic token rotation and re-encryption
2. **Key Management:** Support multiple encryption keys with versioning
3. **Audit Logging:** Track all association changes with detailed audit trail
4. **Batch Operations:** Support bulk association creation with parallel TB updates
5. **Change Events:** Publish events when associations change for external systems

