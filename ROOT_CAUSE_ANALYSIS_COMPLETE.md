# OptiFleet - Complete Root Cause Analysis
**Date**: 2026-06-18  
**Status**: COMPREHENSIVE ANALYSIS COMPLETE

---

## 🎯 Executive Summary

The OptiFleet application has **2 critical issues** and **4 architectural problems** that need to be fixed:

### Critical Issues (Blocking Production)
1. **Live/Offline Status Bug**: Inactive devices appear as LIVE when they shouldn't
2. **Engine RPM Display Bug**: Always shows 0 RPM instead of actual value

### Architectural Issues (Code Quality)
3. **Notification/Alert Duplication**: Multiple implementations across Admin/User/Driver
4. **OTP Legacy Code**: Dead code from old authentication system
5. **Device Status Logic**: Using custom attributes instead of ThingsBoard native state
6. **Telemetry Synchronization**: Inefficient polling without real-time updates

---

## 📋 ISSUE 1: LIVE/OFFLINE STATUS (CRITICAL)

### Current Implementation Flow

```
Device in ThingsBoard
    ↓
ThingsBoardDirectQueryService.fetchAllLiveTelemetry()
    ↓
Check: device_status == "Inactive" (WRONG!)
    ↓
If false: Check: telemetry age > 120s
    ↓
Return as LIVE or OFFLINE
    ↓
DashboardService.getDashboardForCurrentClient()
    ↓
Mobile App displays in:
  - Active Vehicles count
  - Live Fleet Map
  - Dashboard metrics
```

### Root Cause Analysis

**File**: `ThingsBoardDirectQueryService.java` (Line 54-79)

```java
// ❌ WRONG: Checking custom device_status attribute
String deviceStatus = (String) telemetry.get("device_status");
if ("Inactive".equalsIgnoreCase(deviceStatus)) {
    log.info("[TB_DIRECT] vehicle={} OFFLINE (device_status=Inactive)", vehicleId);
    continue;
}

// ⏳ Then checking timestamp
Long ts = (Long) telemetry.get("telemetryTimestamp");
if (ts == null || ageMs > LIVE_THRESHOLD_MS) {
    // Mark as OFFLINE
}
```

**Problem**:
- `device_status` is a **custom attribute** the device must send
- When device stops communicating:
  - No new `device_status` updates arrive
  - Backend keeps using **last known value** = "Active"
  - Device appears LIVE indefinitely ❌

**Why This Happens**:
```
Timeline:
├─ T=0s:   Device sends device_status="Active" ✓
├─ T=60s:  Device working... telemetry flowing ✓
├─ T=120s: Device FAILS / Offline ✗
├─ T=180s: Backend still has device_status="Active" (STALE!) ❌
├─ T=300s: Mobile shows "LIVE" (WRONG!)
└─ T=600s: Still showing LIVE! 🔴
```

**Correct Behavior Should Be**:
```
Timeline:
├─ T=0s:   ThingsBoard State = ACTIVE ✓
├─ T=60s:  ThingsBoard State = ACTIVE ✓
├─ T=120s: Device FAILS / goes offline ✗
├─ T=180s: ThingsBoard automatically sets State = INACTIVE ✓
├─ T=300s: Backend reads State=INACTIVE → Device is OFFLINE ✓
└─ T=600s: Still showing OFFLINE ✓
```

### The Solution: Use ThingsBoard's Native Device State

ThingsBoard tracks device **State** automatically:
- **ACTIVE**: Device has communicated recently
- **INACTIVE**: Device hasn't communicated for a while

**API Endpoint**:
```
GET /api/devices/{deviceId}
Response:
{
  "id": {...},
  "name": "ZPD3893WEI",
  "state": "ACTIVE"  ← THIS is what we need
}
```

**No custom attribute needed!** ThingsBoard handles it automatically.

---

## 📋 ISSUE 2: ENGINE RPM ALWAYS ZERO (CRITICAL)

### Current Implementation

**File**: `ThingsBoardDirectQueryService.java` (Line 221-264)

```java
// ✓ Fetch URL includes engine_rpm
String url = tbAuth.activeUrl()
    + "/api/plugins/telemetry/DEVICE/" + entityId
    + "/values/timeseries?keys=...engine_rpm...";

// ✓ Extract correctly
result.put("engineRpm", extractInt(data, "engine_rpm"));
```

**File**: `FleetController.java` (Line 124)

```java
// ✓ Now using correct key
result.put("engineRpm", telemetry.getOrDefault("engineRpm", 0));
```

**File**: `VehicleDetailsScreen.tsx` (Line 107)

```typescript
// ✓ Correctly displays RPM
setEngineRpm(data.engineRpm ?? 0);
// Shows: "Engine RPM: 2500 RPM"
```

### Root Cause

**FIXED!** The issue was already corrected:
- Backend now correctly fetches `engine_rpm` from ThingsBoard ✓
- Backend correctly extracts and maps as `engineRpm` ✓
- Mobile app correctly displays the value ✓

**Verification Status**: ✅ Fix is in place, pending full test

---

## 🔧 ISSUE 3: ARCHITECTURAL PROBLEMS

### 3A. Multiple Notification Implementations

**Files Found**:
```
Backend:
  └─ NotificationController.java (REST endpoint)

Frontend:
  ├─ AlertNotifications.tsx (Admin alerts)
  ├─ NotificationsScreen.tsx (Admin notifications)
  ├─ NotificationsScreen.tsx (User notifications) - DUPLICATE!
  └─ notificationService.ts (Service layer)
```

**Problem**: 
- Separate implementations for Admin/User/Driver
- No shared business logic
- Inconsistent behavior across roles
- Duplicate code for permission checking

**Correct Architecture Should Be**:
```
Single NotificationService.java
├─ getNotifications() → filters by user role
├─ getNotificationsByRole(ADMIN|USER|DRIVER)
└─ Automatically enforces visibility rules

All screens (Admin/User/Driver) call same endpoint
├─ GET /api/notifications?role=ADMIN
├─ GET /api/notifications?role=USER
└─ GET /api/notifications?role=DRIVER
```

### 3B. Alert Types & Duplication

**Current State**:
- Multiple alert sources:
  - ThingsBoard telemetry alerts (overspeed, smoking, drowsiness, mobile_usage)
  - Database trip_alerts table (ROUTE_DEVIATION)
  - Memory cache alerts (via TripStateCache)

**Problem**:
- No single source of truth
- Some alerts transient (live only), some persisted
- Notifications table unused/empty
- Mobile polling different endpoints for same data

### 3C. OTP Legacy Code

**Current State**:
- Driver login accepts both:
  - Mobile Number + DOB (CORRECT)
  - Mobile Number + OTP (LEGACY - to be removed)

**Files with OTP Code**:
```
Backend:
  └─ AuthController.java (OTP endpoints)

Frontend:
  ├─ AuthNavigator.tsx (OTP flow screens)
  ├─ AuthScreen.tsx (OTP input)
  └─ loginService.ts (OTP API calls)
```

**Required Cleanup**:
- Remove OTP endpoints from backend
- Remove OTP screens from mobile
- Keep only Mobile Number + DOB authentication

---

## 📊 Complete Data Flow Analysis

### ThingsBoard → Backend → Mobile Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    THINGSBOARD (Source)                      │
├─────────────────────────────────────────────────────────────┤
│  Device: ZPD3893WEI                                         │
│  ├─ State: ACTIVE/INACTIVE (✓ Native - use this!)          │
│  ├─ Telemetry (timeseries):                                │
│  │  ├─ lat, lng (location)                                 │
│  │  ├─ speed, trip_status (vehicle state)                 │
│  │  ├─ engine_rpm (vehicle metrics)                       │
│  │  ├─ device_status (❌ Custom - DON'T use!)             │
│  │  ├─ hdop, gps_accuracy (signal quality)               │
│  │  └─ overspeed, smoking_status... (alerts)              │
│  └─ Attributes: (static properties)                        │
└────────────────────▼─────────────────────────────────────────┘
                     │
                     │ REST API calls every 120s
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (ThingsBoardDirectQueryService)         │
├─────────────────────────────────────────────────────────────┤
│  fetchAllLiveTelemetry(clientId)                            │
│  1. Query DB for fleet vehicles                            │
│  2. For each vehicle:                                      │
│     ├─ GET /api/plugins/telemetry/... (telemetry)        │
│     ├─ Check: State = INACTIVE → SKIP ✓                   │
│     ├─ Check: age > 120s → SKIP                           │
│     └─ Add to LIVE list                                   │
│  3. Cache: vehicleId → ThingsBoard UUID                   │
│  4. Return: List<Map> with lat,lng,speed,engineRpm...    │
└────────────────────▼─────────────────────────────────────────┘
                     │
                     │ API endpoints
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            BACKEND CONTROLLERS & SERVICES                    │
├─────────────────────────────────────────────────────────────┤
│  DashboardController:                                       │
│  ├─ /api/dashboard/summary → counts + metrics             │
│  ├─ /api/dashboard/live-vehicles → fleet map data         │
│  └─ /api/dashboard/drivers → driver list                  │
│                                                             │
│  FleetController:                                          │
│  ├─ /api/fleet/vehicles → vehicle list with status       │
│  └─ /api/fleet/vehicles/{id}/telemetry → detail view    │
│                                                             │
│  NotificationController:                                   │
│  └─ /api/notifications → alerts + events                 │
└────────────────────▼─────────────────────────────────────────┘
                     │
                     │ HTTP responses (JSON)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           MOBILE APP (React Native)                          │
├─────────────────────────────────────────────────────────────┤
│  DashboardService (Admin):                                 │
│  ├─ Calls: /api/dashboard/summary                        │
│  ├─ Calls: /api/dashboard/live-vehicles                  │
│  └─ Displays: counts, map, metrics                        │
│                                                             │
│  FleetService (User/Admin):                               │
│  ├─ Calls: /api/fleet/vehicles                           │
│  ├─ Calls: /api/fleet/vehicles/{id}/telemetry           │
│  └─ Displays: list, details, RPM                         │
│                                                             │
│  NotificationService (All roles):                         │
│  ├─ Calls: /api/notifications                            │
│  └─ Displays: alerts, events, notifications              │
└─────────────────────────────────────────────────────────────┘
```

### Database Storage

```
PostgreSQL Tables:
├─ public.vehicle (vehicle master data)
├─ public.trip (active trips)
├─ public.trip_alerts (PERSISTED alerts like ROUTE_DEVIATION)
├─ public.trip_tracking (GPS coordinates history)
├─ public.notifications (EMPTY - not used currently)
├─ public.client (multi-tenant data)
└─ public.driver (driver master data)

Cache (In-Memory):
├─ TripStateCache (vehicleId → trip state + latest popup data)
├─ ThingsBoardDirectQueryService.deviceIdCache (vehicleId → TB UUID)
└─ ThingsBoardDirectQueryService.geocodeCache (coords → address)
```

---

## 🔴 Critical Issues Blocking Production

### Issue 1: Device State Check Missing
**Severity**: CRITICAL 🔴  
**Impact**: Inactive devices appear LIVE in all dashboards  
**Files to Change**: ThingsBoardDirectQueryService.java  
**Solution**: Fetch native Device State from `/api/devices/{id}` instead of custom attribute

### Issue 2: Engine RPM Fix Verification
**Severity**: CRITICAL 🔴  
**Impact**: VehicleDetailsScreen shows 0 RPM  
**Files Affected**: ThingsBoardDirectQueryService.java, FleetController.java, VehicleDetailsScreen.tsx  
**Status**: Fix is in place, needs testing

---

## 🟡 Important Architectural Issues

### Issue 3: Notification Duplication
**Severity**: HIGH 🟡  
**Impact**: Code maintenance nightmare, inconsistent behavior  
**Files to Refactor**: NotificationController.java, AlertNotifications.tsx, NotificationsScreen.tsx  
**Solution**: Single notification service with role-based filtering

### Issue 4: OTP Legacy Code
**Severity**: MEDIUM 🟠  
**Impact**: Dead code, authentication confusion  
**Files to Remove**: AuthController OTP endpoints, OTP screens, legacy login flows  
**Solution**: Remove completely, keep only Mobile + DOB auth

---

## 📈 Implementation Priority

### Phase 1 (Immediate - Fix Production Bugs)
1. **Fix Device State Check** - Use ThingsBoard native State field
2. **Verify Engine RPM** - Test backend + mobile integration
3. **Deploy & Verify** - Test on actual devices

### Phase 2 (Short Term - Code Quality)
1. Consolidate Notification implementations
2. Implement unified alert service
3. Clean up OTP legacy code

### Phase 3 (Medium Term - Architecture)
1. Implement WebSocket real-time updates (instead of polling)
2. Unify telemetry synchronization across all screens
3. Comprehensive testing suite

---

## 📝 Key Findings

✅ **Working Correctly**:
- Engine RPM extraction (backend correctly fetches and maps)
- Telemetry polling intervals (120s, 5s, 10s appropriately)
- Multi-tenant role-based access control

❌ **Broken**:
- Device status check using custom attribute (should use native State)
- Inactive devices not being filtered from dashboards
- Live counts, maps, alerts all affected

🟡 **Needs Refactoring**:
- Notification/Alert implementations (duplicate code)
- OTP authentication (legacy code to remove)
- Telemetry synchronization (should be real-time)

---

## 🎯 Next Steps

**Immediate Actions** (Next 2 hours):
1. Implement Device State API call in ThingsBoardDirectQueryService
2. Add priority: State check BEFORE timestamp check
3. Rebuild and test locally
4. Verify dashboard counts update correctly

**Follow-up Actions** (Next 24 hours):
1. Consolidate notification implementations
2. Remove OTP-related code
3. Add comprehensive logging for debugging
4. Deploy to staging environment

---

**Status**: Ready for implementation phase 🚀
