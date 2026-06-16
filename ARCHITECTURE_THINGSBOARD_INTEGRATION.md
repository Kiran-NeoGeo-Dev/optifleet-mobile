# OptiFleet: ThingsBoard Integration Architecture

**Date:** June 16, 2026  
**Project:** OptiFleet Vehicle Tracking System  
**Version:** 1.0  
**Scope:** Complete pin-to-pin documentation of dashboard widgets, maps, trips, alerts, notifications, ETA, distance calculations, and safety scores

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [ThingsBoard Integration Architecture](#thingsboard-integration-architecture)
3. [Data Models & Associations](#data-models--associations)
4. [Admin Dashboard & Features](#admin-dashboard--features)
5. [User/Client Dashboard & Features](#userclient-dashboard--features)
6. [Driver Application & Features](#driver-application--features)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [ThingsBoard Payload Structures](#thingsboard-payload-structures)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

OptiFleet is a **multi-tenant fleet management system** with three user roles:
- **Admin** (Full visibility)
- **User/Client** (Scoped to their vehicles)
- **Driver** (Personal vehicle tracking)

All real-time data flows through **ThingsBoard**, which:
- Receives telemetry from GPS/IoT devices installed in vehicles
- Stores vehicle state (location, speed, engine status, driver behavior)
- Exposes data via REST API for the OptiFleet backend
- Triggers rules that call OptiFleet webhooks for alerts/events

---

## ThingsBoard Integration Architecture

### Connection Flow

```
[Vehicle/GPS Device]
        ↓ (MQTT/CoAP/HTTP)
[ThingsBoard Server]
        ↓ (JWT Auth)
[OptiFleet Backend API]
        ↓ (REST)
[Mobile App / Web Dashboard]
```

### Key Backend Services

#### 1. **ThingsBoardAuthService** (`src/main/java/.../ThingsBoardAuthService.java`)
- **Purpose:** Manages JWT authentication with ThingsBoard
- **Key Methods:**
  - `getJwtToken()` - Returns cached JWT (58-minute expiry)
  - `forceRefresh()` - Forces new login (called on 401)
  - `activeUrl()` - Returns primary or fallback TB server URL
- **Failover:** Primary → Fallback server with automatic switching
- **Timeout:** 3s connect + 5s read timeout (never blocks dashboard)

#### 2. **ThingsBoardDeviceService** (`src/main/java/.../ThingsBoardDeviceService.java`)
- **Purpose:** Device lifecycle management in ThingsBoard
- **Key Methods:**
  - `createDevice(name)` - Creates new TB device, returns UUID
  - `getAccessToken(tbDeviceId)` - Generates device access token (for IoT device to push telemetry)
  - `updateDevice(tbDeviceId, newName)` - Updates device name
  - `deleteDevice(tbDeviceId)` - Removes device from ThingsBoard
- **Used By:** Vehicle registration workflow

#### 3. **ThingsBoardDirectQueryService** (`src/main/java/.../ThingsBoardDirectQueryService.java`)
- **Purpose:** Direct queries to ThingsBoard for live telemetry
- **Key Methods:**
  - `fetchAllLiveTelemetry(clientId)` - Gets all active vehicles' current position & state
    - Filters: Active vehicles with trips + LIVE telemetry (≤120 sec old)
    - Returns: lat, lng, speed, trip_status, driver behavioral data
  - `fetchSingleVehicleTelemetry(vehicleId)` - Gets specific vehicle's latest telemetry
- **Caching:**
  - Device ID cache: vehicleId → TB entity UUID (reduces TB queries)
  - Geocode cache: "lat,lng" → address (prevents Nominatim rate-limit)
- **LIVE Threshold:** 120 seconds (telemetry timestamp)

#### 4. **LiveTrackingService** (`src/main/java/.../LiveTrackingService.java`)
- **Purpose:** Processes incoming telemetry and maintains live state
- **Conditions for Processing:**
  1. Vehicle exists in `vehicles` table
  2. Valid association exists (`associations.status = true`)
  3. (Optional) Active trip for route/progress tracking
- **Key Operations:**
  - Route matching: Finds nearest point on OSRM route polyline
  - Route deviation detection: Calculates actual vs. planned path
  - Trip status auto-update: Marks trip as "Moving" / "Idle" / "Completed"
  - WebSocket broadcast: Sends updates to connected clients (`/topic/live-tracking/{vehicleId}`)
- **In-Memory Cache:** `TripStateCache` stores active trip state per vehicle

#### 5. **ThingsBoardWebhookController** (`src/main/java/.../ThingsBoardWebhookController.java`)
- **Purpose:** Receives telemetry events from ThingsBoard rule engine
- **Endpoint:** `POST /api/thingsboard/telemetry`
- **Payload Format:** `TelemetryPayload` (see [ThingsBoard Payload Structures](#thingsboard-payload-structures))
- **Response:** `LiveTrackingUpdate` with processed data

---

## Data Models & Associations

### Core Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                          │
├─────────────────────────────────────────────────────────────────┤

├── Vehicles (vehicles table)
│   ├── id (PK)
│   ├── registration_no (unique, maps to TB device name)
│   ├── vehicle_make, vehicle_model
│   ├── vehicle_photo (base64)
│   └── client_id (FK)
│
├── Drivers (drivers table)
│   ├── id (PK)
│   ├── driver_name
│   ├── phone_number
│   ├── front_face_image (base64)
│   └── client_id (FK)
│
├── Associations (associations table)
│   ├── id (PK)
│   ├── vehicle_id (FK)
│   ├── driver_id (FK)
│   ├── client_id (FK)
│   ├── status (boolean)
│   └── [Links vehicles ↔ drivers ↔ clients]
│
├── Trips (trips table)
│   ├── id (PK)
│   ├── vehicle_id (FK)
│   ├── driver_id (FK)
│   ├── client_id (FK)
│   ├── status (enum: Active, Idle, Completed, Cancelled)
│   ├── start_time, end_time
│   ├── custom_polyline (OSRM route as encoded string)
│   └── distance, duration estimates
│
├── Devices (devices table) — **Links OptiFleet → ThingsBoard**
│   ├── id (PK)
│   ├── vehicle_id (FK)
│   ├── tb_device_id (UUID from ThingsBoard)
│   ├── access_token (device credential for telemetry push)
│   └── [Created when vehicle is registered]
│
├── Vehicle Telemetry (vtelemetry table) — **Latest telemetry snapshot**
│   ├── id (PK)
│   ├── vehicle_id (FK)
│   ├── lat, lng (GPS coordinates)
│   ├── speed (km/h)
│   ├── engine_rpm
│   ├── ignition_status
│   ├── trip_status (enum)
│   ├── timestamp (when received)
│   └── [Updated on every telemetry webhook]
│
├── Trip Alerts (trip_alerts table) — **Historical alerts**
│   ├── id (PK)
│   ├── trip_id (FK)
│   ├── alert_type (OVERSPEED, DROWSINESS, SMOKING, MOBILE_USAGE, DEVIATION)
│   ├── lat, lng, description
│   ├── created_at
│   └── [Saved when rule engine fires]
│
├── Clients (clients table)
│   ├── id (PK)
│   ├── client_name
│   ├── role (Admin / User)
│   └── user_details (FK)
│
└── ThingsBoard Devices (External) — **Real IoT devices**
    ├── device_id (UUID)
    ├── device_name (= registration_no)
    ├── device_type = "default"
    └── [Contains live telemetry data]
```

### Critical Link: Vehicle → TB Device → Registration Number

```
OptiFleet Vehicle (DB)
  ↓
  registration_no = "MH-01-AB-1234"
  ↓
  Lookup in TB: devices?deviceName=MH-01-AB-1234
  ↓
  ThingsBoard Device (UUID: "550e8400-e29b-41d4-a716-446655440000")
  ↓
  Latest telemetry: { lat, lng, speed, trip_status, ... }
```

---

## Admin Dashboard & Features

Admin has **full visibility** across all clients and vehicles. No filtering applied.

### Dashboard Summary Widget

**Endpoint:** `GET /api/dashboard/summary`

**Data Source:** ThingsBoard live telemetry + DB queries

**Response Structure:**
```json
{
  "totalDrivers": 150,
  "totalVehicles": 120,
  "totalAssociations": 115,
  "totalDevices": 120,
  "totalTrips": 2050,
  "totalUsers": 25,
  
  "activeVehicles": 45,      // trip_status = "Moving" (LIVE ≤120s)
  "idleVehicles": 35,        // trip_status = "Idle" (LIVE ≤120s)
  "activeDrivers": 48,       // Drivers currently assigned to active vehicles
  "activeAlerts": 12,        // Live alerts from telemetry (overspeed, drowsiness, etc.)
  
  "liveFleetAlerts": [       // Recent alert notifications
    {
      "id": "alert_001",
      "vehicleId": "MH-01-AB-1234",
      "driverName": "John Doe",
      "alertType": "OVERSPEED",
      "description": "Overspeed detected",
      "lat": 19.0760,
      "lng": 72.8777,
      "timestamp": "2026-06-16T10:15:30Z",
      "isResolved": false
    }
  ]
}
```

**Calculation Logic:**

| Widget | Data Source | Filter | Calculation |
|--------|-------------|--------|-------------|
| **Active Vehicles** | `vtelemetry` + `trips` | `trip_status = "Moving" AND timestamp ≥ now - 120s` | COUNT(DISTINCT vehicle_id) |
| **Idle Vehicles** | `vtelemetry` + `trips` | `trip_status = "Idle" AND timestamp ≥ now - 120s` | COUNT(DISTINCT vehicle_id) |
| **Active Drivers** | `vtelemetry` | `driver_id IS NOT NULL AND timestamp ≥ now - 120s` | COUNT(DISTINCT driver_id) |
| **Active Alerts** | `trip_alerts` + live telemetry | Alert fields: overspeed, drowsiness, smoking, mobile_usage = true | SUM(active alerts) |

---

### Live Fleet Map

**Endpoint:** `GET /api/dashboard/live-vehicles`

**Purpose:** Show all vehicle positions on a map in real-time

**Response Structure:**
```json
[
  {
    "vehicleId": "MH-01-AB-1234",
    "lat": 19.0760,
    "lng": 72.8777,
    "speed": 45,
    "driverName": "John Doe",
    "tripStatus": "Moving",
    "popup": {
      "vehicleId": "MH-01-AB-1234",
      "driverName": "John Doe",
      "status": "Moving",
      "speed": "45 km/h",
      "overspeed": "No",
      "smoking": "No",
      "drowsiness": "Normal",
      "mobileUsage": "No",
      "routeDeviation": "Yes",
      "address": "Near Bandra Worli Sea Link, Mumbai",
      "coordinates": "[19.0760, 72.8777]",
      "lastUpdateTime": "10:15:30",
      "lastUpdateDate": "2026-06-16"
    }
  }
]
```

**Data Sources:**
- **Position & Speed:** `ThingsBoardDirectQueryService.fetchAllLiveTelemetry(clientId=null)`
  - Queries TB directly: `/api/entityview/{deviceId}/values/timeseries/`
  - Filters LIVE vehicles (≤120s old)
- **Behavioral Data:** Same TB query returns:
  - `overspeed`, `smoking_status`, `mobile_usage`, `drowsiness_status`
- **Route Deviation:** `TripStateCache` (in-memory, updated on each telemetry)
  - Checks if vehicle is >50m off OSRM route polyline
- **Address:** Reverse geocoding from lat/lng (Nominatim API, cached)

**Map Pin Color Coding:**
| Status | Color | Rule |
|--------|-------|------|
| 🟢 Moving | Green | `trip_status = "Moving" AND speed > 5 km/h` |
| 🟡 Idle | Orange | `trip_status = "Idle" OR speed < 5 km/h` |
| 🔴 Parked | Red | `trip_status = "Parked" OR no LIVE telemetry` |

---

### Trip Management Widget

**Endpoints:**
- `GET /api/trips` - List all active trips
- `GET /api/trips/{id}` - Fetch trip details
- `POST /api/trips/{id}/complete` - Mark trip as completed

**Trip Details:**
```json
{
  "tripId": "trip_001",
  "vehicleId": "MH-01-AB-1234",
  "driverId": 42,
  "driverName": "John Doe",
  "startTime": "2026-06-16T09:00:00Z",
  "endTime": "2026-06-16T10:30:00Z",
  "status": "Active",
  "route": {
    "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",  // OSRM encoded polyline
    "distance": "15.5 km",
    "duration": "45 mins",
    "waypoints": [
      { "lat": 19.0760, "lng": 72.8777 },
      { "lat": 19.1136, "lng": 72.8697 },
      { "lat": 19.1345, "lng": 72.8500 }
    ]
  },
  "progress": {
    "completed_distance": "8.2 km",
    "remaining_distance": "7.3 km",
    "progress_percentage": "53%",
    "eta": "2026-06-16T10:25:00Z"
  },
  "alerts": [
    {
      "type": "OVERSPEED",
      "description": "Exceeded speed limit",
      "location": { "lat": 19.1100, "lng": 72.8700 },
      "timestamp": "2026-06-16T10:10:00Z"
    }
  ]
}
```

**ETA Calculation:**

```
Remaining Distance = Distance from current position to destination
Current Speed = Last recorded speed from telemetry
ETA = now + (Remaining Distance / Current Speed)

Adjustment: If speed < 5 km/h, assume average speed 40 km/h
```

---

### Recent Fleet Alerts Widget

**Endpoint:** `GET /api/notifications` (also used by Driver)

**Purpose:** Show real-time alerts across the entire fleet

**Response Structure:**
```json
[
  {
    "id": "alert_overspeed_001",
    "source": "live",              // "live" = current telemetry, "history" = DB record
    "vehicleId": "MH-01-AB-1234",
    "driverName": "John Doe",
    "alertType": "OVERSPEED",
    "description": "Overspeed detected: 85 km/h in 60 km/h zone",
    "lat": 19.0900,
    "lng": 72.8850,
    "timestamp": "2026-06-16T10:15:30Z",
    "isResolved": false
  },
  {
    "id": "alert_deviation_001",
    "source": "live",
    "vehicleId": "MH-01-AB-2345",
    "driverName": "Jane Smith",
    "alertType": "DEVIATION",
    "description": "Vehicle deviating from planned route",
    "lat": 19.1200,
    "lng": 72.8600,
    "timestamp": "2026-06-16T10:14:15Z",
    "isResolved": false
  }
]
```

**Alert Sources:**

| Alert Type | Source | Data Origin | Calculation |
|------------|--------|-------------|-------------|
| **OVERSPEED** | Live TB telemetry | `speed > 80 km/h` (configurable) | Direct from TB |
| **DROWSINESS** | Live TB telemetry | `drowsiness_status = "fatigue"` | AI model output from edge device |
| **SMOKING** | Live TB telemetry | `smoking_status = "yes"` | AI model output from edge device |
| **MOBILE_USAGE** | Live TB telemetry | `mobile_usage = "yes"` | AI model output from edge device |
| **ROUTE_DEVIATION** | In-memory cache | Polyline distance calculation | `distance_from_route > 50m` |

**Live vs. Historical:**
- **Live Alerts** (source = "live"): Current telemetry from ThingsBoard (last 120s)
- **Historical Alerts** (source = "history"): Saved to `trip_alerts` table when trip completes

---

### Vehicle Details & Telemetry

**Endpoint:** `GET /api/fleet/vehicles/{id}/telemetry`

**Response:**
```json
{
  "vehicleId": 42,
  "licensePlate": "MH-01-AB-1234",
  "vehicleModel": "Hyundai Creta",
  "speed": 45,
  "engineRpm": 2400,
  "ignitionStatus": "ON",
  "tripStatus": "Moving",
  "signalHealth": "Excellent",
  "lastUpdateTime": "10:15:30",
  "lastUpdateDate": "2026-06-16"
}
```

**Data Sources:**
- **Speed, RPM, Ignition, Trip Status:** ThingsBoard latest telemetry
- **Signal Health:** Calculated from last 50 telemetry timestamps
  - Excellent: >90% on-time delivery
  - Good: 70-90%
  - Fair: 50-70%
  - Poor: <50%

---

### Fleet Vehicles Management

**Endpoint:** `GET /api/fleet/vehicles`

**Response:**
```json
[
  {
    "id": 42,
    "licensePlate": "MH-01-AB-1234",
    "vehicleMake": "Hyundai",
    "vehicleModel": "Creta",
    "driverName": "John Doe",
    "tripStatus": "Moving",
    "vehiclePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "clientId": 5
  }
]
```

**Data Assembly:**
1. Get all vehicles from DB (with role-based filtering)
2. Look up driver name from `associations` table
3. Fetch live `trip_status` from TB
4. Return list with enriched data

---

### Fleet Drivers Management

**Endpoint:** `GET /api/fleet/drivers`

**Response:**
```json
[
  {
    "id": 42,
    "driverName": "John Doe",
    "phoneNumber": "+91-98765-43210",
    "photoFront": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "vehicleRegNo": "MH-01-AB-1234",
    "vehicleModel": "Hyundai Creta",
    "tripStatus": "Moving",
    "active": true,
    "safetyScore": 78.5,
    "clientId": 5
  }
]
```

**Safety Score Calculation:**

```
rawScore = 100 - (weighted_event_sum)

Weights per event type:
  - Smoking:      -5 points per incident
  - Mobile Usage: -5 points per incident
  - Overspeed:    -5 points per incident
  - Drowsiness:   -5 points per incident
  - Seatbelt:     -5 points per incident
  - Distraction:  -5 points per incident

Example:
  Base: 100 points
  - 2 overspeed incidents: 100 - (2 × 5) = 90
  - 1 drowsiness incident: 90 - (1 × 5) = 85
  Final Score: 85/100
```

---

### Driver Safety Scorecard

**Endpoint:** `GET /api/fleet/drivers/{id}/scorecard?period=month&year=2026&month=6`

**Response:**
```json
{
  "driverId": 42,
  "driverName": "John Doe",
  "phoneNumber": "+91-98765-43210",
  "photoFront": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "vehicleRegNo": "MH-01-AB-1234",
  "vehicleModel": "Hyundai Creta",
  "period": "2026-06",
  "safetyScore": 78.5,
  "remark": "Good performance. Continue safe driving practices.",
  "events": {
    "smoking": 0,
    "mobile": 2,
    "overspeed": 1,
    "drowsiness": 0,
    "seatbelt": 0,
    "distraction": 0,
    "kmDriven": 450
  }
}
```

**Event Counting:**
```sql
SELECT 
  COUNT(CASE WHEN alert_type = 'SMOKING' THEN 1 END) as smoking,
  COUNT(CASE WHEN alert_type = 'MOBILE_USAGE' THEN 1 END) as mobile,
  COUNT(CASE WHEN alert_type = 'OVERSPEED' THEN 1 END) as overspeed,
  COUNT(CASE WHEN alert_type = 'DROWSINESS' THEN 1 END) as drowsiness,
  COUNT(CASE WHEN alert_type = 'SEATBELT' THEN 1 END) as seatbelt,
  COUNT(CASE WHEN alert_type = 'DISTRACTION' THEN 1 END) as distraction,
  SUM(distance) as kmDriven
FROM trip_alerts ta
JOIN trips t ON t.id = ta.trip_id
WHERE t.vehicle_id IN (SELECT vehicle_id FROM associations WHERE driver_id = ?)
  AND ta.created_at >= '2026-06-01' AND ta.created_at < '2026-07-01'
```

---

## User/Client Dashboard & Features

Client sees **only their vehicles** and **drivers**. Filtered by `client_id`.

### Client-Scoped Dashboard Summary

**Endpoint:** `GET /api/dashboard/summary` (same as Admin, but filtered)

**Key Differences:**
- All queries include `WHERE client_id = ?`
- Active vehicles count limited to client's fleet
- Alerts only for client's vehicles

---

### Client Fleet Map & Vehicle Tracking

**Same endpoints as Admin:**
- `GET /api/dashboard/live-vehicles` (filtered by client_id)
- `GET /api/fleet/vehicles` (filtered by client_id)

**Data Scoping:**
```java
// In ThingsBoardDirectQueryService.fetchAllLiveTelemetry()
if (isAdmin) {
  // Admin: all vehicles
  List<vehicles> = SELECT * FROM vehicles;
} else {
  // Client: only their vehicles
  List<vehicles> = SELECT * FROM vehicles WHERE client_id = ?;
}
```

---

### Client Trip Management

**Endpoint:** `GET /api/trips` (filtered by client_id)

Same trip details as Admin, but scoped to client's vehicles.

---

### Client Vehicle & Driver Lists

**Endpoints:**
- `GET /api/fleet/vehicles` (client-scoped)
- `GET /api/fleet/drivers` (client-scoped)

---

## Driver Application & Features

Driver has **minimal access** - only sees their own vehicle and trip data.

### Driver Login & Authentication

**Endpoints:**
- `POST /api/auth/login` - Driver login with phone + OTP
- `POST /api/auth/verify-otp` - Verify OTP

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "driverId": 42,
  "driverName": "John Doe",
  "phoneNumber": "+91-98765-43210",
  "photoFront": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "role": "Driver",
  "assignedVehicles": [
    {
      "vehicleId": 42,
      "licensePlate": "MH-01-AB-1234",
      "vehicleMake": "Hyundai",
      "vehicleModel": "Creta"
    }
  ]
}
```

---

### Driver Map View

**Endpoint:** `GET /api/driver/map` OR `GET /api/dashboard/live-vehicles` (driver role)

**Response:** Shows ONLY driver's assigned vehicle(s)
```json
[
  {
    "vehicleId": "MH-01-AB-1234",
    "lat": 19.0760,
    "lng": 72.8777,
    "speed": 45,
    "driverName": "John Doe",
    "tripStatus": "Moving",
    "popup": {
      // Same structure as Admin/Client
    }
  }
]
```

---

### Driver Vehicle Movement & Real-Time Tracking

**WebSocket Endpoint:** `WS /topic/live-tracking/{vehicleId}`

**Purpose:** Real-time position updates without polling

**Message Format:**
```json
{
  "vehicleId": "MH-01-AB-1234",
  "lat": 19.0760,
  "lng": 72.8777,
  "speed": 45,
  "bearing": 125,
  "timestamp": "2026-06-16T10:15:30Z",
  "trip_status": "Moving",
  "eta": "2026-06-16T10:25:00Z",
  "remaining_distance": 7.3
}
```

**Data Source:** `LiveTrackingService` broadcasts on every telemetry update

---

### Driver Notifications & Alerts

**Endpoint:** `GET /api/notifications` (driver role filters to own vehicle)

**Alerts Driver Receives:**
- OVERSPEED: When speed exceeds limit
- DROWSINESS: When fatigue detected
- SMOKING: When smoking detected
- MOBILE_USAGE: When phone usage detected
- ROUTE_DEVIATION: When off planned route

**Response:** Same structure as Admin/Client, but for driver's vehicle only

---

### Driver Safety Score

**Endpoint:** `GET /api/fleet/drivers/{driverId}/scorecard?period=month`

**Purpose:** Driver views their own safety performance

**Display:**
```json
{
  "driverId": 42,
  "driverName": "John Doe",
  "period": "2026-06",
  "safetyScore": 78.5,
  "remark": "Good performance. Continue safe driving practices.",
  "events": {
    "smoking": 0,
    "mobile": 2,
    "overspeed": 1,
    "drowsiness": 0,
    "seatbelt": 0,
    "distraction": 0,
    "kmDriven": 450
  }
}
```

---

### Driver Trip Details & ETA

**Endpoint:** `GET /api/trips/{tripId}` (driver's current trip)

**Response:**
```json
{
  "tripId": "trip_001",
  "vehicleId": "MH-01-AB-1234",
  "startTime": "2026-06-16T09:00:00Z",
  "status": "Active",
  "route": {
    "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    "distance": "15.5 km",
    "duration": "45 mins",
    "waypoints": [ ... ]
  },
  "progress": {
    "completed_distance": "8.2 km",
    "remaining_distance": "7.3 km",
    "progress_percentage": "53%",
    "eta": "2026-06-16T10:25:00Z"
  },
  "current_location": {
    "lat": 19.1050,
    "lng": 72.8600,
    "speed": 45,
    "address": "Near Bandra Worli Sea Link, Mumbai"
  }
}
```

**ETA & Distance Calculations:**

1. **Distance Calculation:**
   ```
   Total Distance = Polyline distance from OSRM (encoded in trip.custom_polyline)
   
   Current Position = Latest GPS from ThingsBoard (lat, lng)
   Remaining Distance = calculateRemainingDistance(polyline, currentPosition)
   
   Distance Formula (Haversine):
   d = 2 * R * arcsin(sqrt(sin²((lat2-lat1)/2) + cos(lat1)*cos(lat2)*sin²((lng2-lng1)/2)))
   where R = 6371 km (Earth radius)
   ```

2. **Duration Calculation:**
   ```
   Remaining Duration = Remaining Distance / Average Speed
   
   Average Speed Calculation:
   - If current_speed > 5 km/h: Use current_speed
   - Else: Use average_fleet_speed (typically 40 km/h)
   
   ETA = current_time + Remaining Duration
   ```

3. **Auto-Update Trip Status:**
   ```
   IF current_speed < 5 km/h AND trip_status != "Idle":
     SET trip_status = "Idle"
   
   IF current_speed >= 5 km/h AND trip_status != "Moving":
     SET trip_status = "Moving"
   
   IF progress_percentage >= 95% AND trip_status != "Completing":
     SET trip_status = "Completed"
   ```

---

## API Endpoints Reference

### Dashboard Endpoints

| Method | Endpoint | Role | Description | Response |
|--------|----------|------|-------------|----------|
| GET | `/api/dashboard/summary` | Admin, Client | Dashboard summary stats | DashboardResponse |
| GET | `/api/dashboard/live-vehicles` | Admin, Client, Driver | Live vehicle positions & status | List<VehicleEntry> |
| GET | `/api/dashboard/drivers` | Admin, Client | List all drivers | List<Driver> |
| GET | `/api/dashboard/vehicles` | Admin, Client | List all vehicles | List<Vehicle> |

### Fleet Management Endpoints

| Method | Endpoint | Role | Description | Response |
|--------|----------|------|-------------|----------|
| GET | `/api/fleet/vehicles` | Admin, Client | Fleet vehicles with driver names & status | List<FleetVehicle> |
| GET | `/api/fleet/vehicles/{id}/telemetry` | Admin, Client | Vehicle telemetry & signal health | VehicleTelemetry |
| GET | `/api/fleet/drivers` | Admin, Client | Fleet drivers with vehicle assignments | List<FleetDriver> |
| GET | `/api/fleet/drivers/{id}/scorecard` | Admin, Client, Driver | Driver safety scorecard | DriverScorecard |

### Trip Endpoints

| Method | Endpoint | Role | Description | Response |
|--------|----------|------|-------------|----------|
| GET | `/api/trips` | Admin, Client, Driver | List trips | List<Trip> |
| GET | `/api/trips/{id}` | Admin, Client, Driver | Trip details with ETA | TripDetails |
| POST | `/api/trips` | Admin, Client, Driver | Create new trip | Trip |
| POST | `/api/trips/{id}/complete` | Admin, Client, Driver | Mark trip as completed | Trip |

### Notification Endpoints

| Method | Endpoint | Role | Description | Response |
|--------|----------|------|-------------|----------|
| GET | `/api/notifications` | Admin, Client, Driver | Live alerts from telemetry | List<Notification> |
| POST | `/api/notifications/{id}/resolve` | Admin, Client | Mark alert as resolved | Notification |

### ThingsBoard Webhook (Backend Internal)

| Method | Endpoint | Source | Description | Payload |
|--------|----------|--------|-------------|---------|
| POST | `/api/thingsboard/telemetry` | ThingsBoard Rule Engine | Receive telemetry | TelemetryPayload |

---

## ThingsBoard Payload Structures

### 1. Telemetry Push from Device → ThingsBoard

**Device sends MQTT:**
```json
{
  "device_id": "MH-01-AB-1234",
  "ts": 1718525730000,
  "values": {
    "lat": 19.0760,
    "lng": 72.8777,
    "speed": 45.2,
    "engine_rpm": 2400,
    "ignition_status": "ON",
    "trip_status": "Moving",
    "overspeed": "No",
    "drowsiness_status": "Normal",
    "smoking_status": "No",
    "mobile_usage": "No",
    "seatbelt": "Yes",
    "distraction": "No"
  }
}
```

### 2. ThingsBoard Rule Engine → OptiFleet Webhook

**Triggered on telemetry update:**
```json
{
  "vehicleId": "MH-01-AB-1234",
  "lat": 19.0760,
  "lng": 72.8777,
  "speed": 45.2,
  "engineRpm": 2400,
  "ignitionStatus": "ON",
  "tripStatus": "Moving",
  "overspeed": "No",
  "drowsinessStatus": "Normal",
  "smokingStatus": "No",
  "mobileUsage": "No",
  "seatbelt": "Yes",
  "distraction": "No",
  "timestamp": 1718525730000
}
```

**Mapping:** ThingsBoard transforms MQTT payload into `TelemetryPayload` DTO

### 3. ThingsBoard API Response - Telemetry Query

**OptiFleet queries:** `GET /api/entityview/{deviceId}/values/timeseries/`

**ThingsBoard returns:**
```json
{
  "lat": [19.0760],
  "lng": [72.8777],
  "speed": [45.2],
  "engine_rpm": [2400],
  "ignition_status": ["ON"],
  "trip_status": ["Moving"],
  "overspeed": ["No"],
  "drowsiness_status": ["Normal"],
  "smoking_status": ["No"],
  "mobile_usage": ["No"],
  "seatbelt": ["Yes"],
  "distraction": ["No"],
  "ts": [1718525730000]
}
```

### 4. Device Attributes

**Stored in ThingsBoard (per device):**
```json
{
  "client_id": 5,
  "vehicle_id": 42,
  "driver_id": 42,
  "driver_name": "John Doe",
  "vehicle_model": "Hyundai Creta",
  "max_speed_limit": 80,
  "route_deviation_threshold": 50,
  "last_service_date": "2026-05-01",
  "insurance_expiry": "2027-06-16"
}
```

---

## Data Flow Diagrams

### 1. Real-Time Vehicle Tracking Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME VEHICLE TRACKING FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

[GPS Device in Vehicle]
         ↓ (MQTT: lat, lng, speed, driver_behavior)
         ↓
[ThingsBoard Server]
         ↓ (Rule Engine trigger on telemetry)
         ↓
[OptiFleet Backend: /api/thingsboard/telemetry]
         ↓
[LiveTrackingService.processTelemetry()]
         ├─ Check: Vehicle exists (vehicles table)
         ├─ Check: Association valid (associations table)
         ├─ Check: Active trip (trips table)
         ├─ Match position to route (Haversine)
         ├─ Detect route deviation (if distance > 50m)
         ├─ Auto-update trip status (Moving/Idle/Completed)
         ├─ Save alerts to trip_alerts table
         └─ Update TripStateCache (in-memory)
         ↓
[WebSocket Broadcast: /topic/live-tracking/{vehicleId}]
         ↓
[Mobile App / Web Dashboard]
         ├─ Update map marker position
         ├─ Show speed & direction
         ├─ Update ETA
         └─ Display alerts
```

### 2. Dashboard Summary Widget Load Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│              DASHBOARD SUMMARY WIDGET DATA LOAD FLOW                      │
└─────────────────────────────────────────────────────────────────────────┘

[Dashboard Page Load: GET /api/dashboard/summary]
         ↓
[DashboardService.getDashboardForCurrentClient()]
         ├─ Fetch static counts:
         │  ├─ totalDrivers = SELECT COUNT(*) FROM drivers (WHERE client_id = ?)
         │  ├─ totalVehicles = SELECT COUNT(*) FROM vehicles (WHERE client_id = ?)
         │  └─ totalTrips = SELECT COUNT(*) FROM trips (WHERE status NOT IN (...))
         │
         └─ Fetch LIVE counts via ThingsBoard:
            ├─ Call ThingsBoardDirectQueryService.fetchAllLiveTelemetry(clientId)
            │  ├─ Query TB: GET /api/tenant/devices?type=default
            │  ├─ For each device: GET /api/entityview/{deviceId}/values/timeseries/
            │  ├─ Filter: timestamp ≥ now - 120s (LIVE check)
            │  └─ Return: List of live vehicles with telemetry
            │
            ├─ Count by trip_status:
            │  ├─ activeVehicles = COUNT(WHERE trip_status = "Moving")
            │  └─ idleVehicles = COUNT(WHERE trip_status = "Idle")
            │
            ├─ Count drivers with LIVE vehicles:
            │  └─ activeDrivers = COUNT(DISTINCT driver_id) WHERE telemetry LIVE
            │
            ├─ Count active alerts:
            │  ├─ Overspeed: COUNT(WHERE speed > 80)
            │  ├─ Drowsiness: COUNT(WHERE drowsiness_status = "fatigue")
            │  ├─ Smoking: COUNT(WHERE smoking_status = "yes")
            │  └─ Mobile: COUNT(WHERE mobile_usage = "yes")
            │
            └─ Build response: DashboardResponse
```

### 3. Live Vehicle Map Load Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  LIVE VEHICLE MAP DATA LOAD FLOW                         │
└─────────────────────────────────────────────────────────────────────────┘

[Map Screen Load: GET /api/dashboard/live-vehicles]
         ↓
[DashboardController.getLiveVehicles()]
         ├─ Get current client (from JWT token)
         ├─ Determine if Admin (role = "Admin")
         │
         ├─ Pre-load route deviations from TripStateCache:
         │  └─ For each cached trip: check deviationFlag (set by LiveTrackingService)
         │
         └─ Fetch live telemetry:
            └─ ThingsBoardDirectQueryService.fetchAllLiveTelemetry(clientId)
               ├─ Query active vehicles from trips + associations
               ├─ For each vehicle:
               │  ├─ Resolve TB device ID: queries?deviceName={registration_no}
               │  ├─ Fetch latest telemetry: GET /api/entityview/{deviceId}/values/
               │  ├─ Check LIVE (timestamp ≥ now - 120s)
               │  └─ Reverse geocode (lat,lng → address)
               │
               └─ Build VehicleEntry for each LIVE vehicle:
                  ├─ lat, lng, speed
                  ├─ trip_status (color: green=Moving, orange=Idle, red=Parked)
                  ├─ driver behavioral data (overspeed, drowsiness, etc.)
                  ├─ route deviation (from cache)
                  └─ address
```

### 4. ETA & Distance Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│            ETA & DISTANCE CALCULATION FOR TRIP PROGRESS                  │
└─────────────────────────────────────────────────────────────────────────┘

[Driver Views Trip Details: GET /api/trips/{tripId}]
         ↓
[TripService / LiveTrackingService]
         ├─ Load trip from DB:
         │  ├─ start_time, end_time
         │  ├─ custom_polyline (OSRM encoded route)
         │  └─ status
         │
         ├─ Get current vehicle position from ThingsBoard:
         │  └─ Latest (lat, lng, speed)
         │
         ├─ Decode polyline:
         │  └─ custom_polyline → List<RoutePoint>
         │
         ├─ Calculate total distance:
         │  └─ Sum of Haversine distances between waypoints
         │
         ├─ Match current position to route:
         │  ├─ Find nearest point on polyline
         │  ├─ Calculate distance to nearest point
         │  └─ Update TripStateCache.currentPointIndex
         │
         ├─ Calculate remaining distance:
         │  └─ Sum of distances from current index to end
         │
         ├─ Calculate progress percentage:
         │  └─ progress% = (total - remaining) / total * 100
         │
         ├─ Calculate ETA:
         │  ├─ remaining_time = remaining_distance / current_speed
         │  ├─ If current_speed < 5 km/h:
         │  │  └─ Use average speed (40 km/h) instead
         │  └─ ETA = now + remaining_time
         │
         └─ Return trip progress:
            ├─ completed_distance
            ├─ remaining_distance
            ├─ progress_percentage
            ├─ eta
            └─ last_update_time
```

### 5. Safety Score Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│            DRIVER SAFETY SCORE CALCULATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

[Scorecard Load: GET /api/fleet/drivers/{driverId}/scorecard?period=month]
         ↓
[FleetDriverController.getScorecard()]
         │
         ├─ Query trip_alerts for driver's vehicle(s) in period:
         │  ├─ Join: associations (driver_id = ?) → vehicle_id
         │  ├─ Filter: trip_alerts WHERE vehicle_id IN (...) AND created_at IN [month]
         │  └─ Group by alert_type
         │
         ├─ Count each alert type:
         │  ├─ smoking     = COUNT(WHERE alert_type = 'SMOKING')
         │  ├─ mobile      = COUNT(WHERE alert_type = 'MOBILE_USAGE')
         │  ├─ overspeed   = COUNT(WHERE alert_type = 'OVERSPEED')
         │  ├─ drowsiness  = COUNT(WHERE alert_type = 'DROWSINESS')
         │  ├─ seatbelt    = COUNT(WHERE alert_type = 'SEATBELT')
         │  └─ distraction = COUNT(WHERE alert_type = 'DISTRACTION')
         │
         ├─ Calculate raw score:
         │  └─ score = 100 - (smoking×5 + mobile×5 + overspeed×5 + 
         │             drowsiness×5 + seatbelt×5 + distraction×5)
         │
         ├─ Clamp to 0-100:
         │  └─ IF score < 0: score = 0
         │
         ├─ Generate remark:
         │  ├─ score ≥ 85: "Excellent. Maintain safe driving."
         │  ├─ score ≥ 70: "Good. Continue safe driving practices."
         │  ├─ score ≥ 50: "Fair. Improve your driving habits."
         │  └─ score < 50: "Poor. Urgent coaching required."
         │
         └─ Return DriverScorecard with:
            ├─ safetyScore
            ├─ remark
            └─ events breakdown
```

---

## Summary: Pin-to-Pin Component Connections

### Admin Dashboard Components → Data Sources

| Component | Data Endpoint | Query Type | Filter | Live Threshold |
|-----------|---------------|-----------|--------|-----------------|
| Active Vehicles Widget | ThingsBoard + trips | Direct Query | `trip_status = Moving` | 120s |
| Idle Vehicles Widget | ThingsBoard + trips | Direct Query | `trip_status = Idle` | 120s |
| Active Drivers Widget | ThingsBoard + associations | Direct Query | Has LIVE vehicle | 120s |
| Active Alerts Widget | ThingsBoard telemetry fields | Direct Query | `alert_field = true` | 120s |
| Live Fleet Map | ThingsBoard + geocoding | Direct Query | Active + LIVE | 120s |
| Trip Management | DB + OSRM polyline | DB Query | `status NOT IN (Completed, Cancelled)` | N/A |
| Recent Fleet Alerts | ThingsBoard + trip_alerts DB | Direct Query + DB | Active alerts | 120s (live), Historical (DB) |
| Vehicle Details Telemetry | ThingsBoard | Direct Query | Vehicle ID | 120s |
| Signal Health | ThingsBoard history | History Query | Last 50 readings | N/A |
| Driver Scorecard | trip_alerts DB | DB Aggregation | Period: month/year | N/A |
| ETA Calculation | ThingsBoard (speed) + Polyline | Calculation | Active trip | Real-time |
| Distance Auto Update | Polyline + current position | Calculation | Active trip | Real-time |

### Client Dashboard Components → Data Sources

**Same as Admin, but with `WHERE client_id = ?` on all queries**

### Driver App Components → Data Sources

| Component | Endpoint | Filter |
|-----------|----------|--------|
| Map View | `/api/dashboard/live-vehicles` | Driver's assigned vehicle only |
| Vehicle Movement | WebSocket `/topic/live-tracking/{vehicleId}` | Real-time updates for driver's vehicle |
| Trip ETA | `/api/trips/{tripId}` | Driver's current trip |
| Notifications | `/api/notifications` | Driver's vehicle alerts only |
| Safety Score | `/api/fleet/drivers/{driverId}/scorecard` | Driver's own score |

---

## Technical Stack Summary

| Layer | Technology |
|-------|----------|
| **Real-Time Data** | ThingsBoard MQTT + REST API |
| **Backend** | Spring Boot + Spring Data JPA |
| **Database** | PostgreSQL (vehicles, drivers, trips, alerts) |
| **Mobile Frontend** | React Native (Expo) + TypeScript |
| **Real-Time Communication** | WebSocket (SimpMessagingTemplate) |
| **Routing** | OSRM (Open Source Routing Machine) |
| **Geocoding** | Nominatim (OpenStreetMap) |
| **Distance Calculation** | Haversine formula |

---

## Next Steps & Recommendations

1. **Implement ThingsBoard Rule Engine:**
   - Create rule chains for alert conditions
   - Set up webhook callbacks to `/api/thingsboard/telemetry`

2. **Configure IoT Devices:**
   - Devices send telemetry to ThingsBoard MQTT broker
   - Set device names = vehicle registration numbers

3. **Set Alert Thresholds:**
   - Overspeed: > 80 km/h (configurable per vehicle)
   - Route deviation: > 50m (configurable)

4. **Performance Optimization:**
   - Cache device IDs (already implemented)
   - Implement polling intervals on mobile (10s recommended)
   - Set up DB indexes on `trip_alerts(vehicle_id, created_at)`

5. **Monitoring:**
   - Monitor ThingsBoard connectivity
   - Track webhook response times
   - Alert on data staleness (>2 min without telemetry)

---

**Document Version:** 1.0  
**Last Updated:** June 16, 2026  
**Prepared For:** OptiFleet Development Team
