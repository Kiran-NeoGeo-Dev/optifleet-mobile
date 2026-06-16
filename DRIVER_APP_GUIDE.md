# OptiFleet: Driver Application - Complete Feature Guide

**Role:** Driver  
**Access Level:** Own vehicle only + assigned trips  
**Authentication:** Phone OTP-based login  
**Last Updated:** June 16, 2026

---

## 📱 Driver App Overview

The OptiFleet Driver App provides drivers with real-time navigation, trip tracking, alerts, and safety performance monitoring. All features are personalized to the logged-in driver.

---

## 1. Driver Authentication

### 1.1 Login with Phone OTP

**Endpoint:** `POST /api/auth/login`

**Step 1: Request OTP**

**Payload:**
```json
{
  "phoneNumber": "+91-98765-43210"
}
```

**Response:**
```json
{
  "status": "OTP_SENT",
  "message": "OTP sent to +91-98765-43210",
  "expiresIn": 300,
  "requestId": "req_12345"
}
```

**Step 2: Verify OTP**

**Endpoint:** `POST /api/auth/verify-otp`

**Payload:**
```json
{
  "requestId": "req_12345",
  "otp": "123456"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "driverId": 42,
  "driverInfo": {
    "driverName": "John Doe",
    "phoneNumber": "+91-98765-43210",
    "photoFront": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "license": "DL-2023-001234"
  },
  "assignedVehicles": [
    {
      "vehicleId": 42,
      "licensePlate": "MH-01-AB-1234",
      "vehicleMake": "Hyundai",
      "vehicleModel": "Creta",
      "color": "Pearl White"
    }
  ],
  "role": "Driver"
}
```

### 1.2 Token Management

**Storage:** Secure device storage (React Native AsyncStorage with encryption)

**Expiry:** 24 hours

**Auto-Refresh:**
- Refresh on app resume
- Silent refresh before expiry
- Re-authenticate if token invalid

---

## 2. Home Screen / Dashboard

### 2.1 Quick Status Overview

**Display:**
```
┌─────────────────────────────┐
│  DRIVER APP - HOME          │
├─────────────────────────────┤
│                             │
│  Driver: John Doe           │
│  Vehicle: MH-01-AB-1234     │
│  Model: Hyundai Creta       │
│                             │
│  STATUS INDICATORS:         │
│  ✓ Logged In                │
│  ✓ Vehicle: Ready           │
│  ✓ Signal: Excellent        │
│  ✓ Safety Score: 78.5       │
│                             │
│  [START TRIP] [MY TRIPS]    │
│  [ALERTS] [SCORECARD]       │
└─────────────────────────────┘
```

### 2.2 Navigation Tabs

| Tab | Purpose | Features |
|-----|---------|----------|
| **Home** | Dashboard overview | Quick status, start trip |
| **Map** | Real-time tracking | Live position, ETA, alerts |
| **Trips** | Trip history | Past trips, statistics |
| **Alerts** | Safety alerts | Recent incidents, severity |
| **Profile** | Driver settings | Profile, password, logout |

---

## 3. Trip Management

### 3.1 Start New Trip

**UI Flow:**
```
[Home Screen]
      ↓
  [Start Trip Button]
      ↓
[Trip Destination Form]
  ├─ Select destination (from recent/favorites)
  ├─ OR enter address
  ├─ OR choose from trip list
      ↓
[Confirm Trip]
  ├─ Show route
  ├─ Show distance & ETA
  ├─ Show alerts on route (if any)
      ↓
[Begin Trip]
  └─ App starts tracking
```

**Create Trip - API Call:**

**Endpoint:** `POST /api/trips`

**Payload:**
```json
{
  "vehicleId": 42,
  "driverId": 42,
  "destination": {
    "lat": 19.1345,
    "lng": 72.8500,
    "address": "Mumbai Airport Terminal 1"
  },
  "waypoints": [
    { "lat": 19.1100, "lng": 72.8600 },
    { "lat": 19.1200, "lng": 72.8550 }
  ]
}
```

**Response:**
```json
{
  "tripId": "trip_001",
  "vehicleId": "MH-01-AB-1234",
  "driverId": 42,
  "startTime": "2026-06-16T09:00:00Z",
  "status": "Active",
  "route": {
    "polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    "totalDistance": "15.5 km",
    "totalDuration": "45 mins",
    "waypoints": [...]
  }
}
```

### 3.2 Active Trip Screen

**Endpoint:** `GET /api/trips/{tripId}`

**Real-Time Display:**

```
┌─────────────────────────────────────┐
│  ACTIVE TRIP - MH-01-AB-1234        │
├─────────────────────────────────────┤
│                                     │
│  DESTINATION: Mumbai Airport        │
│                                     │
│  [MAP VIEW - Current Position]      │
│  ├─ Blue route polyline             │
│  ├─ Green dot (current vehicle)     │
│  ├─ Red pin (destination)           │
│  └─ Real-time updates every 5s      │
│                                     │
│  TRIP PROGRESS:                     │
│  ════════░░░░ 53%                   │
│                                     │
│  Distance: 8.2 / 15.5 km            │
│  Remaining: 7.3 km                  │
│  Speed: 45 km/h                     │
│  ETA: 10:25 AM (15 mins)            │
│                                     │
│  CURRENT LOCATION:                  │
│  Western Express Highway, Mumbai    │
│  Last Update: 10:15:30              │
│                                     │
│  [ALERTS: 1] [NAVIGATION] [END TRIP]│
└─────────────────────────────────────┘
```

### 3.3 Real-Time ETA Updates

**Calculation (Every 5 seconds):**

```
FETCH: Latest vehicle telemetry from ThingsBoard
  └─ current_lat, current_lng, current_speed

FIND: Nearest point on route polyline
  └─ Match current position to route

CALCULATE: Remaining distance
  └─ Sum polyline segments from current point to destination

CALCULATE: Remaining time
  IF current_speed > 5 km/h:
    remaining_time = remaining_distance / current_speed
  ELSE:
    remaining_time = remaining_distance / 40 km/h (average)

CALCULATE: ETA
  eta = current_time + remaining_time

UPDATE: UI with new values
  ├─ Progress percentage
  ├─ Remaining distance
  ├─ Remaining time
  └─ ETA timestamp
```

**Distance Calculation:**

```
Total Distance = Decode polyline and sum Haversine distances

Remaining Distance = 
  FOR each segment from currentIndex to destination:
    SUM(Haversine(point[n], point[n+1]))

Progress % = (Total - Remaining) / Total × 100
```

### 3.4 Trip Auto-Status Updates

**Logic (Updated on each telemetry):**

```
IF speed < 5 km/h AND trip_status != "Idle":
  trip_status = "Idle"
  UPDATE: Database + UI

IF speed >= 5 km/h AND trip_status != "Moving":
  trip_status = "Moving"
  UPDATE: Database + UI

IF progress_percentage >= 95% AND vehicle near destination:
  trip_status = "Completing"
  SHOW: Finish trip prompt

IF trip_status = "Completing" AND manual confirmation:
  trip_status = "Completed"
  Calculate trip summary
  Disable trip management actions
```

### 3.5 Navigation Integration

**Features:**
- **Turn-by-turn directions** (optional third-party integration)
- **Voice guidance** (TTS)
- **Re-route** if deviated from planned route
- **Alternative routes** on delay

### 3.6 End Trip

**Endpoint:** `POST /api/trips/{tripId}/complete`

**Actions on End:**
1. Calculate final trip metrics
2. Move live alerts to historical
3. Close trip record
4. Generate trip summary

**Trip Summary:**
```json
{
  "tripId": "trip_001",
  "duration": {
    "actualDuration": 42,
    "estimatedDuration": 45,
    "timeDeviation": -3
  },
  "distance": {
    "actualDistance": 15.2,
    "plannedDistance": 15.5,
    "distanceDeviation": -0.3
  },
  "performance": {
    "avgSpeed": 21.7,
    "maxSpeed": 65,
    "alerts": 1,
    "routeAdherence": 98
  }
}
```

---

## 4. Map & Real-Time Tracking

### 4.1 Live Map View

**Endpoint:** WebSocket `/topic/live-tracking/{vehicleId}`

**Real-Time Features:**
- Current GPS position (updated every 5 seconds)
- Route polyline (blue line)
- Destination marker (red pin)
- Current bearing/heading
- Speed indicator
- Live ETA

**Map Elements:**
```
Route:
  Blue polyline from start to destination
  
Current Position:
  Animated green dot
  Shows vehicle bearing as arrow
  
Destination:
  Red pin at end point
  
Waypoints:
  Small numbered circles
  
Alerts:
  Warning icons on map where alerts triggered
```

### 4.2 Map Controls

**Gestures:**
- 2-finger pinch: Zoom in/out
- Pan: Drag to move view
- Double-tap: Center on vehicle
- Long-press: Show location details

**Buttons:**
- 📍 Center on vehicle
- 🛰 GPS toggle
- 🔊 Audio alerts toggle
- ⚙️ Settings

### 4.3 Live Position Broadcast

**Data Source:** LiveTrackingService (WebSocket)

**Message Format:**
```json
{
  "vehicleId": "MH-01-AB-1234",
  "lat": 19.0760,
  "lng": 72.8777,
  "speed": 45,
  "bearing": 125,
  "accuracy": 10,
  "timestamp": "2026-06-16T10:15:30Z",
  "tripStatus": "Moving",
  "eta": "2026-06-16T10:25:00Z",
  "remainingDistance": 7.3
}
```

**Update Frequency:** Every 5 seconds

---

## 5. Alerts & Safety Monitoring

### 5.1 Real-Time Alert Notifications

**Types of Alerts:**

| Alert | Trigger | Display |
|-------|---------|---------|
| **OVERSPEED** | speed > 80 km/h | Red banner + sound |
| **DROWSINESS** | AI detects fatigue | Yellow banner + vibration |
| **SMOKING** | AI detects smoking | Yellow banner |
| **MOBILE_USAGE** | AI detects phone use | Yellow banner |
| **ROUTE_DEVIATION** | off route > 50m | Blue banner |
| **SEATBELT** | seatbelt unbuckled | Red banner + sound |

**Alert Display (In-App):**

```
┌─────────────────────────────┐
│ ⚠️  ALERT: OVERSPEED        │
├─────────────────────────────┤
│ Speed: 85 km/h              │
│ Limit: 60 km/h              │
│ Location: Highway junction  │
│ Time: 10:15:30              │
│                             │
│ [ACKNOWLEDGE] [DETAILS]     │
└─────────────────────────────┘
```

### 5.2 Alerts History

**Endpoint:** `GET /api/notifications`

**Filter:** Only driver's vehicle + today's trips

**Display:**
```
Alert Type | Vehicle | Location | Time | Status
──────────────────────────────────────────────
OVERSPEED | MH-01-AB-1234 | Highway | 10:15 | Acknowledged
DROWSINESS | MH-01-AB-1234 | City Road | 09:45 | Acknowledged
```

**Alert Details:**
```json
{
  "alertId": "alert_overspeed_001",
  "vehicleId": "MH-01-AB-1234",
  "alertType": "OVERSPEED",
  "severity": "High",
  "description": "Speeding at 85 km/h in 60 km/h zone",
  "location": {
    "lat": 19.0900,
    "lng": 72.8850,
    "address": "Western Express Highway"
  },
  "timestamp": "2026-06-16T10:15:30Z",
  "acknowledged": true,
  "acknowledgedAt": "2026-06-16T10:15:35Z"
}
```

### 5.3 Alert Sound & Vibration

**Configuration:**
- Sound: Enabled by default
- Vibration: Enabled by default
- Mute option: Available in settings

**Sound Types:**
- Critical (drowsiness): Loud beep + vibration
- High (overspeed, seatbelt): Medium beep + vibration
- Medium (smoking, mobile): Soft beep

---

## 6. Safety Score & Performance

### 6.1 Safety Score Card

**Endpoint:** `GET /api/fleet/drivers/{driverId}/scorecard?period=month`

**Display on Home Screen (Quick View):**
```
Safety Score: 78.5
Grade: B+
Status: Good
Incidents This Month: 3
```

**Full Scorecard View:**

```
┌─────────────────────────────┐
│  SAFETY SCORECARD           │
├─────────────────────────────┤
│                             │
│  Score: 78.5 / 100          │
│  Grade: B+                  │
│  ████████░░ 78.5%           │
│                             │
│  ASSESSMENT:                │
│  "Good performance.         │
│   Continue safe driving     │
│   practices."               │
│                             │
│  INCIDENTS (June):          │
│  ├─ Overspeed: 1            │
│  ├─ Mobile Usage: 2         │
│  ├─ Drowsiness: 0           │
│  ├─ Smoking: 0              │
│  └─ Other: 0                │
│                             │
│  STATISTICS:                │
│  ├─ Distance: 450 km        │
│  ├─ Trips: 28               │
│  ├─ Hours: 36.5             │
│  └─ Avg Speed: 35 km/h      │
│                             │
│  [DETAILED VIEW]            │
└─────────────────────────────┘
```

### 6.2 Score Calculation

**Real-Time Calculation:**

```
BASE = 100

DEDUCTIONS (from trip_alerts):
  IF month has alerts:
    FOR each alert_type in [smoking, mobile, overspeed, drowsiness, ...]:
      score -= COUNT(alert_type) × weight
      
Weights:
  - Smoking: 5 points per incident
  - Mobile: 5 points per incident
  - Overspeed: 5 points per incident
  - Drowsiness: 5 points per incident
  - Seatbelt: 5 points per incident
  - Other: 3 points per incident

FINAL_SCORE = MAX(0, BASE - TOTAL_DEDUCTIONS)

GRADE:
  90-100: A (Excellent)
  80-89:  B (Good)
  70-79:  C (Fair)
  60-69:  D (Poor)
  < 60:   F (Critical)
```

### 6.3 Performance Trends

**Period Selection:**
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Custom range
- By month
- By year

**Chart Display:**
```
Score Trend (30 days):
  100 ├─────────────────────
      │    ╱╲        ╱╲
   80 ├──╱  ╲──────╱  ╲────
      │╱      ╲    ╱    ╲
   60 └────────╲──╱──────╲──
      01  07  14  21  30 (day)
```

---

## 7. Trip History

### 7.1 My Trips List

**Endpoint:** `GET /api/trips?driverId={driverId}&status=completed`

**Display:**
```
Date | Vehicle | Distance | Duration | Alerts | Score
─────────────────────────────────────────────────────
Today | MH-01-AB-1234 | 15.5 km | 45 min | 1 | 78.5
Yesterday | MH-01-AB-1234 | 22.3 km | 52 min | 0 | 82.0
```

### 7.2 Trip Summary Details

**Tap Trip → View Details**

**Information:**
```json
{
  "tripId": "trip_001",
  "date": "2026-06-16",
  
  "tripMetrics": {
    "distance": 15.2,
    "duration": 42,
    "avgSpeed": 21.7,
    "maxSpeed": 65
  },
  
  "route": {
    "start": { "time": "09:00", "location": "Office" },
    "end": { "time": "09:42", "location": "Client Site" },
    "waypoints": 2
  },
  
  "performance": {
    "speedCompliance": 98,
    "routeAdherence": 99,
    "incidents": 1,
    "safetyScore": 78
  },
  
  "alerts": [
    {
      "type": "OVERSPEED",
      "time": "09:30",
      "location": "Highway",
      "speed": 85
    }
  ]
}
```

### 7.3 Statistics Page

**Features:**
- Total trips this month
- Total km driven
- Total hours driven
- Average speed
- Best performing day
- Most frequent route

---

## 8. Driver Profile

### 8.1 Profile Screen

```
┌─────────────────────────────┐
│  MY PROFILE                 │
├─────────────────────────────┤
│                             │
│  [PHOTO]                    │
│                             │
│  Name: John Doe             │
│  Phone: +91-98765-43210     │
│  License: DL-2023-001234    │
│  Vehicle: MH-01-AB-1234     │
│  Model: Hyundai Creta       │
│                             │
│  STATS:                     │
│  ├─ Member Since: Jan 2025  │
│  ├─ Trips Completed: 150    │
│  ├─ Total Distance: 4500 km │
│  └─ Safety Score: 78.5      │
│                             │
│  [EDIT PROFILE]             │
│  [SETTINGS]                 │
│  [LOGOUT]                   │
└─────────────────────────────┘
```

### 8.2 Edit Profile

**Editable Fields:**
- Phone number
- Emergency contact
- Profile photo
- Password

### 8.3 App Settings

**Options:**
- Notifications: On/Off, Sound, Vibration
- Map settings: Zoom level, theme
- Language: English, Hindi, Marathi, etc.
- Auto-sync: On/Off
- Offline mode: Available trips cache

### 8.4 Logout

**Endpoint:** `POST /api/auth/logout`

**Actions:**
- Clear JWT token
- Clear cached data
- Return to login screen
- Timestamp logout event

---

## 9. Offline Mode

### 9.1 Limited Offline Features

**Available Offline:**
- View cached trip list
- View cached trip details
- View cached scorecard
- View profile information
- View past alerts (cached)

**Not Available Offline:**
- Start new trip
- Real-time map
- Live alerts
- Live position updates

### 9.2 Auto-Sync

**On Reconnection:**
- Sync trips data
- Sync alerts
- Sync scorecard
- Download new trips

---

## 10. Background Location Tracking

### 10.1 Location Permission

**Requirement:** Background location permission (Android/iOS)

**User Prompt:**
```
"OptiFleet Driver needs background location access to track 
your vehicle's GPS position during trips. This is required 
for real-time ETA updates and safety monitoring."

[Deny] [Allow Always] [Allow While Using App]
```

### 10.2 Background Service

**Behavior:**
- Starts when app opens
- Continues even if app minimized
- Stops when trip ends
- Can be manually paused

**Battery Impact:**
- ~5% per hour (typical GPS usage)
- More efficient with vehicle stationary

---

## 11. Data Usage Optimization

### 11.1 Network Efficiency

**Data Consumption:**
- Telemetry: ~1 KB per 5 seconds = ~10 MB/day per vehicle
- Map tiles: ~5-10 MB per trip
- Alerts: <1 KB each

**Network Preference:**
- Prefer WiFi over cellular
- Compress data transfers
- Cache map tiles locally

### 11.2 Power Saving

**Features:**
- Reduce refresh rate when low battery
- Disable background tracking
- Reduce map quality
- Disable animations

---

## 12. Accessibility

### 12.1 Features

- Text size scaling
- Dark mode support
- Voice guidance
- Haptic feedback
- High contrast mode

---

## 13. Troubleshooting

### 13.1 No Trip Data Loading

**Check:**
1. Internet connection stable?
2. App has location permission?
3. Logged in correctly?
4. Token not expired?

### 13.2 GPS Not Working

**Check:**
1. GPS enabled on phone?
2. Location permission granted?
3. Signal available?
4. App restarted?

### 13.3 Alerts Not Appearing

**Check:**
1. Vehicle sending telemetry?
2. Notification settings enabled?
3. Sound/vibration working?

---

## 14. Data Refresh Intervals

| Component | Refresh Rate | Auto-Refresh |
|-----------|-------------|--------------|
| Trip Progress | 5 seconds | Yes |
| Map Position | 5 seconds | Yes |
| ETA | 5 seconds | Yes |
| Alerts | Real-time | WebSocket |
| Trip List | 1 minute | Yes |
| Scorecard | 1 minute | Yes |
| Profile | On demand | No |

---

## 15. Best Practices

1. **Start trip before driving** - Ensures accurate tracking
2. **End trip when done** - Closes trip record properly
3. **Check alerts** - Address issues immediately
4. **Monitor safety score** - Improve driving habits
5. **Keep app updated** - Bug fixes and features
6. **Maintain device** - Keep GPS enabled, battery charged
7. **Accept coaching** - Work to improve safety score

---

## 16. Support

### 16.1 In-App Help

- FAQ section
- Video tutorials
- Contact support

### 16.2 Contact

- Phone: [Support number]
- Email: support@optifleet.com
- WhatsApp: [Support group]

---

**Document Version:** 1.0  
**Last Updated:** June 16, 2026  
**Driver App Guide - OptiFleet**
