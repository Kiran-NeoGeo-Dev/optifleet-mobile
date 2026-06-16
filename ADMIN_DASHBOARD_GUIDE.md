# OptiFleet: Admin Dashboard - Complete Feature Guide

**Role:** Administrator  
**Access Level:** Full visibility across all clients and vehicles  
**Last Updated:** June 16, 2026

---

## 📊 Admin Dashboard Overview

The Admin Dashboard provides comprehensive fleet management with real-time visibility into all vehicles, drivers, trips, and safety metrics across the entire system.

---

## 1. Dashboard Summary Widgets

### 1.1 Active Vehicles Widget

**Purpose:** Shows number of vehicles currently in motion

**Endpoint:** `GET /api/dashboard/summary`

**Data Calculation:**
```
Active Vehicles = COUNT(DISTINCT vehicles WHERE trip_status = "Moving" AND timestamp ≥ now - 120s)
```

**Data Source Flow:**
```
1. Query ThingsBoard: Get all devices with latest telemetry
2. Filter: trip_status = "Moving"
3. Check: Timestamp ≤ 120 seconds old (LIVE check)
4. Count: Unique vehicle IDs
5. Return: Active vehicle count
```

**Interpretation:**
- **Green indicator:** Vehicles actively on trips
- **Real-time:** Updated every 10 seconds (polling interval)
- **Threshold:** 120 seconds of data staleness = vehicle goes OFFLINE

---

### 1.2 Idle Vehicles Widget

**Purpose:** Shows vehicles with engines running but not moving

**Calculation:**
```
Idle Vehicles = COUNT(DISTINCT vehicles WHERE trip_status = "Idle" AND timestamp ≥ now - 120s)
```

**Conditions for Idle Status:**
- Ignition: ON
- Speed: < 5 km/h
- Last telemetry: ≤ 120 seconds old
- Active trip exists OR parked with known location

---

### 1.3 Active Drivers Widget

**Purpose:** Shows drivers currently assigned to moving or idle vehicles

**Calculation:**
```
Active Drivers = COUNT(DISTINCT drivers WHERE 
  - driver_id IN (SELECT driver_id FROM associations WHERE vehicle_id IN active_vehicles)
  - AND vehicle has LIVE telemetry (≤120s)
```

**Data Assembly:**
1. Get all active vehicles (as above)
2. Look up driver_id from `associations` table
3. Count unique drivers

---

### 1.4 Active Alerts Widget

**Purpose:** Real-time count of triggered safety/behavioral alerts

**Alert Types Tracked:**
| Alert Type | Trigger Condition | Source |
|------------|------------------|--------|
| OVERSPEED | speed > 80 km/h | ThingsBoard telemetry |
| DROWSINESS | drowsiness_status = "fatigue" | AI model on edge device |
| SMOKING | smoking_status = "yes" | AI model on edge device |
| MOBILE_USAGE | mobile_usage = "yes" | AI model on edge device |
| SEATBELT | seatbelt_status = "unbuckled" | Sensor input |

**Calculation:**
```
Active Alerts = SUM(
  COUNT(WHERE overspeed = "Yes") +
  COUNT(WHERE drowsiness = "Fatigue") +
  COUNT(WHERE smoking = "Yes") +
  COUNT(WHERE mobile_usage = "Yes") +
  COUNT(WHERE seatbelt = "No")
)
```

**Where:** All vehicles with LIVE telemetry (≤120s)

---

## 2. Live Fleet Map

### 2.1 Map Display & Controls

**Features:**
- Real-time vehicle marker positions
- Color-coded by status (Moving/Idle/Parked)
- Clickable markers show vehicle details popup
- Zoom/pan controls
- Search vehicle by registration number
- Filter by trip status
- Auto-refresh every 10 seconds

### 2.2 Vehicle Markers & Status Indicators

**Status Colors:**
```
🟢 GREEN  → Moving (speed > 5 km/h, trip_status = "Moving")
🟡 YELLOW → Idle (speed < 5 km/h, engines running)
🔴 RED    → Parked (trip_status = "Parked" OR no telemetry > 120s)
⚫ GREY   → Offline (no telemetry > 120s)
```

**Marker Information:**
- Vehicle registration number
- Current GPS coordinates
- Last update time

### 2.3 Vehicle Popup Details

**Triggered By:** Clicking map marker

**Popup Shows:**
```json
{
  "vehicleId": "MH-01-AB-1234",
  "driverName": "John Doe",
  "status": "Moving",
  "speed": "45 km/h",
  "location": "Near Bandra Worli Sea Link, Mumbai",
  "coordinates": "[19.0760, 72.8777]",
  "lastUpdate": "10:15:30 on 2026-06-16",
  
  "alerts": {
    "overspeed": "No",
    "drowsiness": "Normal",
    "smoking": "No",
    "mobileUsage": "No",
    "routeDeviation": "Yes",
    "seatbelt": "Buckled"
  }
}
```

**Data Sources:**
- **Position & Speed:** ThingsBoard latest telemetry
- **Driver Name:** `associations` table lookup
- **Location:** Reverse geocoding (Nominatim API)
- **Alerts:** Current telemetry field values
- **Route Deviation:** In-memory `TripStateCache`

---

## 3. Trip Management

### 3.1 Active Trips List

**Endpoint:** `GET /api/trips`

**View:** Shows all active trips with key metrics

**Trip Status Flow:**
```
Created → Active → Idle → Moving → Idle → ... → Completing → Completed
```

**Auto-Status Update Logic:**
```
IF current_speed < 5 km/h AND trip_status != "Idle":
  SET trip_status = "Idle"
  
IF current_speed >= 5 km/h AND trip_status != "Moving":
  SET trip_status = "Moving"
  
IF progress_percentage >= 95% AND vehicle near destination:
  SET trip_status = "Completing"
  
IF progress_percentage = 100% OR manual completion:
  SET trip_status = "Completed"
```

### 3.2 Trip Details View

**Endpoint:** `GET /api/trips/{tripId}`

**Details Include:**

1. **Trip Summary**
   ```json
   {
     "tripId": "trip_001",
     "vehicleId": "MH-01-AB-1234",
     "driverId": 42,
     "driverName": "John Doe",
     "startTime": "2026-06-16T09:00:00Z",
     "status": "Active",
     "duration": "1 hour 25 minutes"
   }
   ```

2. **Route Information**
   ```json
   {
     "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",  // Encoded by OSRM
     "totalDistance": "15.5 km",
     "totalDuration": "45 mins",
     "waypoints": [
       { "lat": 19.0760, "lng": 72.8777, "description": "Start" },
       { "lat": 19.1136, "lng": 72.8697, "description": "Waypoint 1" },
       { "lat": 19.1345, "lng": 72.8500, "description": "End" }
     ]
   }
   ```

3. **Progress Tracking**
   ```json
   {
     "completedDistance": "8.2 km",
     "remainingDistance": "7.3 km",
     "progressPercentage": "53%",
     "currentLocation": {
       "lat": 19.1050,
       "lng": 72.8600,
       "speed": "45 km/h"
     },
     "eta": "2026-06-16T10:25:00Z"
   }
   ```

4. **Alerts During Trip**
   ```json
   [
     {
       "alertType": "OVERSPEED",
       "description": "Exceeded speed limit",
       "location": { "lat": 19.1100, "lng": 72.8700 },
       "timestamp": "2026-06-16T10:10:00Z",
       "resolved": false
     }
   ]
   ```

### 3.3 ETA & Distance Calculations

**Distance Calculation Process:**

```
Step 1: Decode OSRM Polyline
  polyline = trip.custom_polyline
  waypoints = decodePolyline(polyline)
  
Step 2: Calculate Total Distance
  totalDistance = 0
  FOR EACH consecutive pair of waypoints:
    totalDistance += haversineDistance(point1, point2)
    
Step 3: Get Current Position
  currentLat, currentLng = Latest ThingsBoard telemetry
  currentSpeed = Latest ThingsBoard speed
  
Step 4: Find Nearest Point on Route
  nearestPoint = findNearestPointOnPolyline(currentLat, currentLng)
  distanceToRoute = haversineDistance(current, nearestPoint)
  
Step 5: Calculate Remaining Distance
  remainingDistance = 0
  FOR EACH waypoint from nearestPoint to end:
    remainingDistance += haversineDistance(waypoint[n], waypoint[n+1])
```

**ETA Calculation:**

```
Step 1: Get Current Speed
  currentSpeed = Last telemetry reading
  
Step 2: Validate Speed
  IF currentSpeed < 5 km/h:
    // Vehicle is stopped; use average speed
    effectiveSpeed = 40 km/h (configurable)
  ELSE:
    effectiveSpeed = currentSpeed
    
Step 3: Calculate Remaining Time
  remainingTime = remainingDistance / effectiveSpeed
  
Step 4: Calculate ETA
  ETA = currentTime + remainingTime
  
Step 5: Adjust for Traffic (Optional)
  // Can add traffic factor from OSRM or external API
```

**Haversine Formula:**
```
d = 2 * R * arcsin(sqrt(sin²((Δlat)/2) + cos(lat1)*cos(lat2)*sin²((Δlon)/2)))

Where:
  d = distance in km
  R = 6371 km (Earth radius)
  Δlat = lat2 - lat1
  Δlon = lon2 - lon1
```

### 3.4 Manual Trip Actions

**Create Trip:**
- Endpoint: `POST /api/trips`
- Input: Vehicle ID, Driver ID, Destination coordinates
- OSRM Route: Automatically fetched and encoded
- Response: Trip ID, route polyline, estimated duration

**Complete Trip:**
- Endpoint: `POST /api/trips/{tripId}/complete`
- Action: Marks trip as "Completed"
- Calculation: Final distance traveled, duration, metrics
- Alerts: Moves live alerts to `trip_alerts` table (historical)

---

## 4. Recent Fleet Alerts

### 4.1 Alert Display

**Endpoint:** `GET /api/notifications`

**Shows:**
- Current active alerts from vehicle telemetry
- Historical alerts from completed trips
- Severity-based sorting (highest first)

**Alert Properties:**
```json
{
  "alertId": "alert_overspeed_001",
  "vehicleId": "MH-01-AB-1234",
  "driverName": "John Doe",
  "alertType": "OVERSPEED",
  "severity": "High",
  "description": "Speeding at 85 km/h in 60 km/h zone",
  "location": {
    "lat": 19.0900,
    "lng": 72.8850,
    "address": "Western Express Highway, Mumbai"
  },
  "timestamp": "2026-06-16T10:15:30Z",
  "source": "live",              // "live" or "history"
  "isResolved": false
}
```

### 4.2 Alert Types & Triggers

| Alert Type | Trigger | Data Source | Severity |
|------------|---------|-------------|----------|
| OVERSPEED | speed > 80 km/h | ThingsBoard field | High |
| DROWSINESS | drowsiness_status = "fatigue" | AI model | Critical |
| SMOKING | smoking_status = "yes" | AI model | Medium |
| MOBILE_USAGE | mobile_usage = "yes" | AI model | Medium |
| SEATBELT | seatbelt = "unbuckled" | Sensor | High |
| ROUTE_DEVIATION | distance_from_route > 50m | Polyline calc | Low |
| HARSH_ACCELERATION | acceleration > 0.4G | Sensor | Medium |
| HARSH_BRAKING | deceleration > -0.5G | Sensor | Medium |

### 4.3 Mark Alert as Resolved

**Endpoint:** `POST /api/notifications/{alertId}/resolve`

**Action:** Sets `isResolved = true` on alert

---

## 5. Fleet Vehicles Management

### 5.1 Vehicles List

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
1. Query `vehicles` table
2. Lookup driver from `associations` table
3. Get `trip_status` from ThingsBoard (latest telemetry)
4. Include vehicle photo (base64 encoded)

### 5.2 Vehicle Details & Telemetry

**Endpoint:** `GET /api/fleet/vehicles/{id}/telemetry`

**Response:**
```json
{
  "vehicleId": 42,
  "licensePlate": "MH-01-AB-1234",
  "vehicleModel": "Hyundai Creta",
  
  "telemetry": {
    "speed": 45,
    "engineRpm": 2400,
    "ignitionStatus": "ON",
    "tripStatus": "Moving",
    "fuelLevel": "75%"
  },
  
  "health": {
    "signalHealth": "Excellent",        // Based on telemetry delivery %
    "gpsAccuracy": "±10 meters",
    "lastUpdateTime": "10:15:30",
    "lastUpdateDate": "2026-06-16",
    "connectionStatus": "Connected"
  }
}
```

**Signal Health Calculation:**
```
Recent telemetry points = Last 50 timestamp records
On-time deliveries = COUNT(timestamp[n] - timestamp[n-1] ≈ 5 seconds)
On-time percentage = on-time_deliveries / 50 * 100

Signal Health:
  >= 90%: "Excellent"
  70-90%: "Good"
  50-70%: "Fair"
  < 50%:  "Poor"
```

### 5.3 Vehicle Search & Filter

**Search Options:**
- By License Plate
- By Vehicle Model
- By Driver Name
- By Trip Status (Moving/Idle/Parked)
- By Client

---

## 6. Fleet Drivers Management

### 6.1 Drivers List

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

**Active Status Determination:**
```
driver.active = 
  (tripStatus = "Moving" OR tripStatus = "Idle") 
  AND telemetry_timestamp <= now - 120s
```

### 6.2 Driver Safety Scorecard

**Endpoint:** `GET /api/fleet/drivers/{id}/scorecard?period=month&year=2026&month=6`

**Response:**
```json
{
  "driverId": 42,
  "driverName": "John Doe",
  "period": "2026-06",
  
  "performance": {
    "safetyScore": 78.5,
    "remark": "Good performance. Continue safe driving practices.",
    "scoreGrade": "B+"
  },
  
  "events": {
    "smoking": 0,
    "mobile": 2,
    "overspeed": 1,
    "drowsiness": 0,
    "seatbelt": 0,
    "distraction": 0,
    "harshAcceleration": 3,
    "harshBraking": 2,
    "kmDriven": 450,
    "tripsCompleted": 28
  },
  
  "monthlyTrend": [
    { "date": "2026-06-01", "score": 75.0 },
    { "date": "2026-06-02", "score": 76.5 },
    ...
    { "date": "2026-06-16", "score": 78.5 }
  ]
}
```

**Safety Score Algorithm:**

```
BASE_SCORE = 100

DEDUCTIONS:
  smoking_incidents          × 5 points each
  mobile_usage_incidents     × 5 points each
  overspeed_incidents        × 5 points each
  drowsiness_incidents       × 5 points each
  seatbelt_violations        × 5 points each
  distraction_incidents      × 5 points each
  harsh_acceleration_events  × 3 points each
  harsh_braking_events       × 3 points each

FINAL_SCORE = MAX(0, BASE_SCORE - TOTAL_DEDUCTIONS)

GRADE MAPPING:
  90-100: A (Excellent)
  80-89:  B (Good)
  70-79:  C (Fair)
  60-69:  D (Poor)
  < 60:   F (Critical)

REMARK:
  >= 85:  "Excellent. Maintain safe driving."
  >= 70:  "Good. Continue safe driving practices."
  >= 50:  "Fair. Improve your driving habits."
  < 50:   "Poor. Urgent coaching required."
```

### 6.3 Period Selection

**Available Periods:**
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Custom date range
- By month (2026-06, 2026-05, etc.)
- By year

---

## 7. Notifications Center

### 7.1 Alert Summary

**Shows:**
- Total active alerts
- Alerts by type (pie chart)
- Alerts by vehicle (list)
- Alerts by driver (list)

### 7.2 Notification Settings

**Configure:**
- Alert severity threshold (show only High/Critical)
- Alert types to display
- Notification sound/vibration
- Email alerts to admin

---

## 8. System Administration

### 8.1 Client Management

**Manage:**
- Create new clients
- Edit client details
- Assign subscription tier
- View client analytics

### 8.2 User Management

**Manage:**
- Create admin users
- Edit user roles
- Reset passwords
- View login history

### 8.3 Device Management

**Manage:**
- Register new GPS devices
- Assign devices to vehicles
- View device credentials
- Update device firmware

### 8.4 Configuration

**Settings:**
- Overspeed threshold (default: 80 km/h)
- Route deviation threshold (default: 50m)
- LIVE data threshold (default: 120 seconds)
- Polling interval (default: 10 seconds)
- ThingsBoard connection details
- OSRM server URL
- Nominatim API settings

---

## 9. Reports & Analytics

### 9.1 Fleet Summary Report

**Generates:**
- Total vehicles, drivers, trips
- Active/idle/parked breakdown
- Top violators (by alerts)
- Fuel consumption summary
- Distance traveled summary

### 9.2 Driver Performance Report

**Shows:**
- Safety scores (sorted)
- Alert counts by type
- Trip statistics
- Comparison to fleet average

### 9.3 Vehicle Health Report

**Shows:**
- Service history
- Fuel efficiency
- Signal health trends
- Maintenance alerts

### 9.4 Compliance Report

**Tracks:**
- Seatbelt usage
- Speed compliance
- Route adherence
- Break compliance

---

## 10. Data Refresh Intervals

| Component | Refresh Rate | Source |
|-----------|-------------|--------|
| Dashboard Summary | 10 seconds | ThingsBoard live query |
| Live Map | 10 seconds | ThingsBoard live query |
| Trip Progress | 5 seconds | ThingsBoard + cache |
| Alerts | 5 seconds | ThingsBoard + DB |
| Driver List | 30 seconds | DB + ThingsBoard |
| Scorecard | On demand | DB aggregation |

---

## 11. Troubleshooting

### 11.1 No Live Vehicles Showing

**Possible Causes:**
1. ThingsBoard server offline → Check connection
2. No telemetry from devices → Check device configuration
3. Data older than 120s → Devices not sending updates
4. Device names don't match registration numbers → Check TB device names

### 11.2 ETA Not Calculating

**Causes:**
1. No OSRM route in trip → Create trip with waypoints
2. Current speed = 0 → Use average speed fallback
3. Vehicle off polyline → Check route validity

### 11.3 Alerts Not Appearing

**Causes:**
1. ThingsBoard rule engine not triggering → Check rule configuration
2. Webhook endpoint not responding → Check backend logs
3. Alert thresholds too high → Adjust settings
4. Telemetry data missing fields → Check device configuration

---

## 12. Best Practices

1. **Monitor signal health** - Alert if any vehicle > 2 minutes without telemetry
2. **Review alerts daily** - Identify problem drivers early
3. **Maintain device credentials** - Rotate access tokens quarterly
4. **Calibrate thresholds** - Adjust overspeed limit per road type
5. **Regular backups** - Export scorecard data monthly
6. **Driver coaching** - Intervene with low-scoring drivers
7. **Vehicle maintenance** - Schedule based on service history

---

**Document Version:** 1.0  
**Last Updated:** June 16, 2026  
**Admin User Guide - OptiFleet**
