# OptiFleet API Testing Guide - Device Renaming & Public Marking

## Quick Test: Device Renaming & Public Flag

### Prerequisites
- Backend running on port 8083
- Authentication token (JWT)
- Vehicle ID and Device ID ready

---

## Test Flow

### Step 1: Create a Device (Auto-marks as PUBLIC)

**Endpoint:** `POST http://localhost:8083/api/devices`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "deviceId": "TEST_RENAME_001",
  "imeiNumber": "999888777666555",
  "deviceType": "GPS Tracker",
  "clientId": 1
}
```

**Expected Response:**
```json
{
  "id": 999,
  "deviceId": "TEST_RENAME_001",
  "imeiNumber": "999888777666555",
  "deviceType": "GPS Tracker",
  "clientId": 1,
  "createdAt": "2026-06-23T10:30:00Z"
}
```

**Logs to Watch:**
```
INFO  ThingsBoardDeviceService - TB device created: name=TEST_RENAME_001 id=<uuid> public=true
✅ Confirm "public=true" in log
```

**Verify in ThingsBoard:**
1. Go to ThingsBoard UI → Devices
2. Find device "TEST_RENAME_001"
3. Check device properties → should show "Public: true"

---

### Step 2: Create Association (Triggers Device Rename)

**Endpoint:** `POST http://localhost:8083/api/admin-associations`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicle_id": 1,
  "device_id": 999
}
```

**Expected Response:**
```json
{
  "id": 100,
  "vehicleId": 1,
  "deviceId": 999,
  "createdAt": "2026-06-23T10:31:00Z"
}
```

**Logs to Watch:**
```
✅ INFO  AdminAssociationService - TB device renamed: vehicleId=1 deviceId=999 licensePlate=AP26UM5558
```

**Verify in ThingsBoard:**
1. Go to ThingsBoard UI → Devices
2. Find device previously named "TEST_RENAME_001"
3. Name should now be: "AP26UM5558" (vehicle registration number)

---

### Step 3: Update Association (Updates Device Name)

**Endpoint:** `PUT http://localhost:8083/api/admin-associations/100`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicle_id": 2,
  "device_id": 999
}
```

**Expected Response:**
```json
{
  "id": 100,
  "vehicleId": 2,
  "deviceId": 999,
  "createdAt": "2026-06-23T10:31:00Z"
}
```

**Logs to Watch:**
```
✅ INFO  AdminAssociationService - TB device renamed: vehicleId=2 deviceId=999 licensePlate=TS09AB1234
```

**Verify in ThingsBoard:**
1. Device name should now be: "TS09AB1234" (new vehicle registration)

---

### Step 4: Delete Association (Restore Device Name)

**Endpoint:** `DELETE http://localhost:8083/api/admin-associations/100`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "message": "Admin association deleted successfully"
}
```

**Logs to Watch:**
```
✅ INFO  AdminAssociationService - TB device renamed back to original: deviceId=999 originalName=TEST_RENAME_001
```

**Verify in ThingsBoard:**
1. Device name should be restored to: "TEST_RENAME_001" (original device ID)

---

## Test With Existing Device (DEV_630)

### Get Vehicle ID and Device ID First

**Query to find IDs:**
```sql
-- Find device
SELECT id FROM devices WHERE device_id = 'DEV_630';
-- Result: device_id = 2 (for example)

-- Find vehicle with registration
SELECT id, registration_number FROM vehicles LIMIT 1;
-- Result: vehicle_id = 1, registration_number = AP26UM5558
```

### Create Association for DEV_630

**Endpoint:** `POST http://localhost:8083/api/admin-associations`

**Request Body:**
```json
{
  "vehicle_id": 1,
  "device_id": 2
}
```

**Expected Result:**
- DB: New row in admin_associations table
- TB: Device "DEV_630" renamed to "AP26UM5558"
- Logs: "TB device renamed: vehicleId=1 deviceId=2 licensePlate=AP26UM5558"

---

## Verify Encryption Works

### Query Database

```sql
-- Check encrypted token format
SELECT device_id, 
       LENGTH(tb_access_token) AS token_length,
       SUBSTRING(tb_access_token FROM 1 FOR 20) AS token_preview
FROM device_tb_mapping 
WHERE device_id = 'DEV_630' 
OR device_id = 'TEST_RENAME_001';
```

**Expected Result:**
```
device_id              | token_length | token_preview
DEV_630                | 64           | pNjBKk3Nyy7ECZNmzJoA...
TEST_RENAME_001        | 64           | <base64_characters>...
```

✅ Token is **NOT** starting with "eyJ..." (not plain JWT)
✅ Token is Base64-encoded (starts with pN, gA, etc.)

---

## Using cURL (Command Line)

### Get JWT Token First

```bash
curl -X POST http://localhost:8083/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }' \
  | jq '.token'
```

### Test Device Renaming

```bash
# Store token
TOKEN="eyJhbGciOiJIUzI1NiJ9..."

# Create association
curl -X POST http://localhost:8083/api/admin-associations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "device_id": 2
  }'

# Check logs
curl -X GET http://localhost:8083/api/admin-associations \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Expected Logs Output

### Successful Flow

```
[INFO] 2026-06-23 10:30:15.123 - DeviceService - Device saved locally: deviceId=TEST_RENAME_001
[INFO] 2026-06-23 10:30:15.456 - ThingsBoardDeviceService - TB device created: name=TEST_RENAME_001 id=e05268a0-6e67-11f1-9310-310e28342b74 public=true
[INFO] 2026-06-23 10:30:15.789 - DeviceService - TB mapping saved: deviceId=TEST_RENAME_001 tbDeviceId=e05268a0-6e67-11f1-9310-310e28342b74

[INFO] 2026-06-23 10:31:15.123 - AdminAssociationService - TB device renamed: vehicleId=1 deviceId=999 licensePlate=AP26UM5558
```

### Error Cases (To Troubleshoot)

```
[ERROR] Failed to rename ThingsBoard device: 401 Unauthorized
→ Check TB credentials in application.properties
→ Check TB server connectivity

[ERROR] Failed to rename ThingsBoard device: Vehicle not found with ID: 1
→ Check vehicleId exists in database

[ERROR] Failed to rename ThingsBoard device: Device not found with ID: 999
→ Check deviceId exists in database

[WARN] No ThingsBoard device found for device code: TEST_RENAME_001
→ Check device_tb_mapping table has the device
→ Verify device was created in ThingsBoard
```

---

## Checklist: Everything Working?

- [ ] Device created shows "public=true" in logs
- [ ] Device created is marked PUBLIC in ThingsBoard UI
- [ ] Association created triggers device rename in logs
- [ ] ThingsBoard device name matches vehicle registration
- [ ] Association update triggers device rename with new vehicle
- [ ] Association delete restores original device name
- [ ] Token in database is encrypted (Base64 format)
- [ ] No plain-text tokens visible in database
- [ ] All API endpoints return correct responses
- [ ] No 401/403 errors in logs

---

## Quick Curl Testing (One-Liner Format)

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8083/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass"}' | jq -r '.token')

# Create device
DEV_ID=$(curl -s -X POST http://localhost:8083/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"TEST001","imeiNumber":"123456789","deviceType":"GPS"}' | jq -r '.id')

# Create association (this triggers device rename)
curl -s -X POST http://localhost:8083/api/admin-associations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"vehicle_id\":1,\"device_id\":$DEV_ID}" | jq '.'
```

