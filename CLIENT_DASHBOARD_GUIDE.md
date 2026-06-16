# OptiFleet: Client/User Dashboard - Complete Feature Guide

**Role:** Client/User  
**Access Level:** View only own vehicles and drivers  
**Client-Based Scoping:** All queries filtered by `client_id`  
**Last Updated:** June 16, 2026

---

## 📊 Client Dashboard Overview

The Client Dashboard provides fleet managers with visibility into their own vehicles, drivers, and trips. All data is scoped to their organization only.

---

## 1. Dashboard Access & Authentication

### 1.1 Login

**Endpoint:** `POST /api/auth/login`

**Payload:**
```json
{
  "email": "manager@clientcompany.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 10,
  "clientId": 5,
  "role": "User",
  "permissions": [
    "VIEW_DASHBOARD",
    "VIEW_VEHICLES",
    "VIEW_DRIVERS",
    "VIEW_TRIPS",
    "VIEW_ALERTS",
    "MANAGE_TRIPS"
  ]
}
```

**Token Storage:**
- Stored in device secure storage (React Native)
- Attached to all subsequent API requests as Bearer token
- Expires after 24 hours (refresh on app resume)

---

## 2. Client Dashboard Summary

### 2.1 Dashboard Widgets

**Endpoint:** `GET /api/dashboard/summary`

**Response (Client-Scoped):**
```json
{
  "clientInfo": {
    "clientId": 5,
    "clientName": "Mumbai Transport Co.",
    "subscriptionTier": "Pro"
  },
  
  "totalStats": {
    "totalDrivers": 45,
    "totalVehicles": 40,
    "totalAssociations": 38,
    "totalTrips": 850
  },
  
  "liveStats": {
    "activeVehicles": 15,
    "idleVehicles": 12,
    "activeDrivers": 20,
    "activeAlerts": 3
  },
  
  "recentAlerts": [
    {
      "alertId": "alert_001",
      "vehicleId": "MH-01-AB-1234",
      "driverName": "John Doe",
      "alertType": "OVERSPEED",
      "description": "Exceeding speed limit",
      "timestamp": "2026-06-16T10:15:30Z"
    }
  ]
}
```

**Data Filtering:**
```sql
-- All queries automatically include:
WHERE client_id = {loggedInClientId}
```

**Widget Values:**
| Widget | Calculation | Data Source |
|--------|-----------|------------|
| Active Vehicles | COUNT(WHERE trip_status = "Moving" AND timestamp ≤ 120s) | ThingsBoard |
| Idle Vehicles | COUNT(WHERE trip_status = "Idle" AND timestamp ≤ 120s) | ThingsBoard |
| Active Drivers | COUNT(DISTINCT driver_id) WHERE vehicle LIVE | ThingsBoard + DB |
| Active Alerts | SUM(active alert conditions) | ThingsBoard |

---

## 3. Fleet Map

### 3.1 Client-Scoped Map View

**Endpoint:** `GET /api/dashboard/live-vehicles`

**Key Difference from Admin:**
- Shows ONLY client's vehicles
- Same real-time updates (10-second refresh)
- Same color coding (Green/Yellow/Red)

**Response:**
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
      "drowsiness": "Normal",
      "smoking": "No",
      "mobileUsage": "No",
      "routeDeviation": "No",
      "address": "Western Express Highway, Mumbai",
      "lastUpdate": "10:15:30"
    }
  }
]
```

### 3.2 Map Controls

**Features:**
- Zoom in/out
- Pan map
- Search vehicle by license plate
- Filter by status (Moving/Idle/Parked)
- Show/hide vehicle labels
- Toggle satellite view
- Real-time location update (10s interval)

### 3.3 Vehicle Marker Interaction

**Click Marker → Show Popup:**
- Vehicle ID & photo
- Driver name
- Current speed
- Trip status
- Recent alerts
- Last update time

**Long-Press Marker → Options:**
- View vehicle details
- Start tracking
- View trip history
- Contact driver (if available)

---

## 4. Vehicle Management

### 4.1 Vehicles List

**Endpoint:** `GET /api/fleet/vehicles`

**View:** All client's vehicles with current status

**List Display:**
```
License Plate | Make/Model | Driver | Status | Last Update
─────────────────────────────────────────────────────────
MH-01-AB-1234 | Hyundai Creta | John Doe | Moving | 10:15:30
MH-01-AB-2345 | Honda City    | Jane Smith | Idle | 10:15:25
MH-01-AB-3456 | Maruti Swift  | — | Parked | 08:30:00
```

**Sorting Options:**
- By status (Active/Idle/Parked)
- By license plate
- By driver name
- By last update (newest first)

**Search:**
- Search by license plate
- Search by driver name
- Search by vehicle model

### 4.2 Vehicle Details Screen

**Tap Vehicle → Details Page**

**Information Displayed:**
```json
{
  "vehicleId": 42,
  "licensePlate": "MH-01-AB-1234",
  "vehicleInfo": {
    "make": "Hyundai",
    "model": "Creta",
    "year": 2023,
    "color": "Pearl White",
    "photo": "data:image/jpeg;base64,..."
  },
  
  "currentStatus": {
    "tripStatus": "Moving",
    "driver": "John Doe",
    "speed": 45,
    "engineRpm": 2400,
    "ignitionStatus": "ON",
    "lastUpdateTime": "10:15:30",
    "lastUpdateDate": "2026-06-16"
  },
  
  "health": {
    "signalHealth": "Excellent",
    "fuelLevel": "75%",
    "batteryHealth": "Good"
  },
  
  "location": {
    "address": "Western Express Highway, Mumbai",
    "coordinates": "[19.0760, 72.8777]"
  }
}
```

**Data Refresh:**
- Auto-refresh every 10 seconds while screen is open
- Pull-to-refresh available
- WebSocket updates for instant changes

---

## 5. Driver Management

### 5.1 Drivers List

**Endpoint:** `GET /api/fleet/drivers`

**Display:**
```
Name | Phone | Vehicle | Status | Safety Score
─────────────────────────────────────────────
John Doe | +91-98765-43210 | MH-01-AB-1234 | Active | 78.5
Jane Smith | +91-98765-43211 | MH-01-AB-2345 | Active | 82.0
Mike Wilson | +91-98765-43212 | — | Inactive | 65.0
```

**Status Indicators:**
- 🟢 **Active** → Has LIVE vehicle telemetry (≤120s)
- ⚫ **Inactive** → No telemetry or vehicle parked

**Sort By:**
- Safety score (highest first)
- Driver name (A-Z)
- Active status
- Recent activity

### 5.2 Driver Safety Scorecard

**Endpoint:** `GET /api/fleet/drivers/{driverId}/scorecard?period=month`

**Information:**
```json
{
  "driverId": 42,
  "driverName": "John Doe",
  "phoneNumber": "+91-98765-43210",
  "photoFront": "data:image/jpeg;base64,...",
  
  "vehicleAssigned": {
    "licensePlate": "MH-01-AB-1234",
    "vehicleModel": "Hyundai Creta"
  },
  
  "scorecard": {
    "period": "2026-06",
    "safetyScore": 78.5,
    "scoreGrade": "B+",
    "remark": "Good performance. Continue safe driving practices."
  },
  
  "events": {
    "smoking": 0,
    "mobile": 2,
    "overspeed": 1,
    "drowsiness": 0,
    "seatbelt": 0,
    "distraction": 0,
    "harshAcceleration": 3,
    "harshBraking": 2
  },
  
  "statistics": {
    "kmDriven": 450,
    "tripsCompleted": 28,
    "totalDrivingHours": 36.5,
    "averageSpeed": 35.2
  }
}
```

**Period Selector:**
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Custom date range
- By month
- By year

**Score Breakdown (Visual):**
- Pie chart: % of trips with alerts
- Line chart: Score trend over time
- Bar chart: Incidents by type

---

## 6. Trip Management

### 6.1 Active Trips List

**Endpoint:** `GET /api/trips`

**Display:**
```
Vehicle | Driver | Status | Distance | ETA | Last Update
────────────────────────────────────────────────────────
MH-01-AB-1234 | John | Moving | 8.2/15.5 km | 10:25 | 10:15:30
MH-01-AB-2345 | Jane | Idle | 12.0/20.0 km | 10:45 | 10:10:00
```

**Trip Status Colors:**
- 🟢 **Moving** → Vehicle in motion
- 🟡 **Idle** → Engine on, not moving
- 🔵 **Completing** → Within 5% of destination
- 🔴 **Parked** → No active trip

### 6.2 Trip Details & Tracking

**Endpoint:** `GET /api/trips/{tripId}`

**Information:**
```json
{
  "tripId": "trip_001",
  
  "tripInfo": {
    "vehicleId": "MH-01-AB-1234",
    "driverId": 42,
    "driverName": "John Doe",
    "startTime": "2026-06-16T09:00:00Z",
    "status": "Active"
  },
  
  "route": {
    "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    "totalDistance": "15.5 km",
    "totalDuration": "45 mins",
    "waypoints": [...]
  },
  
  "progress": {
    "completedDistance": "8.2 km",
    "remainingDistance": "7.3 km",
    "progressPercentage": "53%",
    "currentSpeed": "45 km/h",
    "eta": "2026-06-16T10:25:00Z",
    "timeRemaining": "15 mins"
  },
  
  "currentLocation": {
    "lat": 19.1050,
    "lng": 72.8600,
    "address": "Western Express Highway, Mumbai",
    "lastUpdate": "2026-06-16T10:15:30Z"
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

### 6.3 ETA & Distance Display

**Real-Time Updates:**
- ETA updates every 5 seconds based on current speed
- Remaining distance decreases as vehicle moves
- Progress percentage increases gradually

**ETA Calculation (Real-Time):**
```
IF vehicle speed > 5 km/h:
  remaining_time = remaining_distance / current_speed
ELSE:
  remaining_time = remaining_distance / 40 km/h (average)
  
ETA = current_time + remaining_time
```

**Distance Calculation:**
```
Remaining distance = Sum of polyline segments from current point to destination
```

**Display Format:**
```
Remaining: 7.3 km
ETA: 10:25 AM (15 minutes)
Progress: ████████░░ 53%
```

### 6.4 Live Route View

**Trip Map Display:**
- Route polyline (blue line)
- Current vehicle position (green dot)
- Destination marker (red pin)
- Waypoints (numbered)
- Real-time vehicle movement

**Updates:**
- Vehicle position updates every 5 seconds
- ETA recalculates based on latest speed
- Alerts shown as icons on map

### 6.5 Create New Trip

**Endpoint:** `POST /api/trips`

**Input Form:**
```
Vehicle Selection: [Dropdown: Select vehicle]
Driver Selection: [Dropdown: Select driver]
Destination: [Text input + location picker]
Waypoints: [Optional: Add waypoints]
Trip Date: [Date picker]
Trip Start Time: [Time picker]
```

**On Submit:**
1. Validate inputs
2. Fetch OSRM route (auto)
3. Create trip record
4. Assign to vehicle
5. Show confirmation

---

## 7. Notifications & Alerts

### 7.1 Alert Center

**Endpoint:** `GET /api/notifications`

**Shows:** Real-time alerts for client's vehicles

**Alert Types:**
| Type | Severity | Example |
|------|----------|---------|
| OVERSPEED | High | Exceeded speed limit |
| DROWSINESS | Critical | Driver fatigue detected |
| SMOKING | Medium | Smoking detected |
| MOBILE_USAGE | Medium | Phone usage detected |
| ROUTE_DEVIATION | Low | Off planned route |
| SEATBELT | High | Seatbelt unbuckled |

**Alert Display:**
```json
{
  "alertId": "alert_overspeed_001",
  "vehicleId": "MH-01-AB-1234",
  "driverName": "John Doe",
  "alertType": "OVERSPEED",
  "severity": "High",
  "description": "Speeding at 85 km/h in 60 km/h zone",
  "location": "Western Express Highway",
  "timestamp": "2026-06-16T10:15:30Z",
  "isResolved": false
}
```

### 7.2 Alert Notifications

**Real-Time Push:**
- Sound notification for High/Critical alerts
- Badge on app icon
- Lock screen notification (iOS)
- Notification drawer (Android)

**Notification Settings:**
- Enable/disable notifications
- Sound on/off
- Vibration on/off
- Alert types to show
- Quiet hours (e.g., 10 PM - 6 AM)

### 7.3 Mark Alert as Resolved

**Endpoint:** `POST /api/notifications/{alertId}/resolve`

**Action:**
- Sets `isResolved = true`
- Moves to historical alerts
- Removed from active alerts list

---

## 8. Trip History

### 8.1 Completed Trips List

**Endpoint:** `GET /api/trips?status=completed`

**Display:**
```
Date | Vehicle | Driver | Distance | Duration | Alerts
─────────────────────────────────────────────────────
2026-06-16 | MH-01-AB-1234 | John | 15.5 km | 45 min | 1
2026-06-15 | MH-01-AB-2345 | Jane | 22.3 km | 52 min | 0
```

**Filters:**
- By date range
- By vehicle
- By driver
- By status

### 8.2 Trip Summary Report

**For Completed Trip:**
- Total distance traveled
- Actual vs. estimated time
- Fuel consumed
- Number of alerts
- Speed compliance %
- Route adherence %

---

## 9. Fleet Statistics

### 9.1 Dashboard Charts

**Widgets:**
1. **Active Vehicles Timeline** (24-hour)
   - Line chart: Active vehicle count over time
   - Shows peak hours

2. **Alert Distribution** (pie chart)
   - % overspeed
   - % drowsiness
   - % smoking
   - % mobile usage
   - % other

3. **Driver Performance** (bar chart)
   - Top 5 drivers by safety score
   - Shows scores and trend

4. **Vehicle Status** (pie chart)
   - % Moving
   - % Idle
   - % Parked
   - % Offline

### 9.2 Export Reports

**Options:**
- Export to PDF (trip summary)
- Export to Excel (driver scorecard)
- Email report
- Share via link

---

## 10. Settings & Preferences

### 10.1 Profile Settings

**Update:**
- Name
- Email
- Phone number
- Photo
- Password

### 10.2 Notification Preferences

**Configure:**
- Alert types to receive
- Notification sound
- Vibration settings
- Email alerts
- Quiet hours

### 10.3 Map Preferences

**Customize:**
- Map type (satellite/street)
- Show/hide vehicle labels
- Show/hide route polylines
- Auto-center on vehicle
- Theme (light/dark)

---

## 11. Support & Help

### 11.1 In-App Support

**Features:**
- FAQ section
- Video tutorials
- Contact support button
- Feedback form

### 11.2 Offline Mode

**Limited Functionality:**
- View cached trip history
- View cached vehicle list
- View cached driver list
- Re-sync when online

---

## 12. Security & Privacy

### 12.1 Data Access

**Client Can Access:**
- Own vehicles only
- Own drivers only
- Own trips only
- Own client-scoped alerts
- Cannot see other clients' data

### 12.2 Logout

**Endpoint:** `POST /api/auth/logout`

**Action:**
- Invalidates JWT token
- Clears cached data
- Returns to login screen

---

## 13. Data Refresh Intervals

| Component | Refresh Rate | Auto-Refresh |
|-----------|-------------|--------------|
| Dashboard Summary | 10 seconds | Yes |
| Fleet Map | 10 seconds | Yes |
| Trip Progress | 5 seconds | Yes |
| Alerts | 5 seconds | Yes |
| Vehicle List | 30 seconds | Yes |
| Driver List | 30 seconds | Yes |
| Trip History | On demand | No |

---

## 14. Troubleshooting

### 14.1 No Vehicles Showing

**Check:**
1. Are vehicles assigned to this client? (Contact admin)
2. Are devices sending telemetry? (Check signal health)
3. Is connection stable? (Check internet)

### 14.2 ETA Not Accurate

**Reasons:**
1. Speed data delay (5-10 seconds normal)
2. Heavy traffic not factored (OSRM default)
3. Roadwork/detours affecting route

### 14.3 Alerts Not Received

**Check:**
1. Notification settings enabled?
2. Vehicle has LIVE telemetry?
3. Alert thresholds configured?

---

## 15. Best Practices

1. **Check dashboard daily** - Monitor fleet activity
2. **Review safety scores** - Identify coaching opportunities
3. **Track trip history** - Understand patterns
4. **Report issues** - Contact support for stuck trips
5. **Keep app updated** - Get latest features
6. **Monitor data usage** - Real-time map updates use data

---

**Document Version:** 1.0  
**Last Updated:** June 16, 2026  
**Client/User Dashboard Guide - OptiFleet**
