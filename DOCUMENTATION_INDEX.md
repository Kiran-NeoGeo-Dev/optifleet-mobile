# OptiFleet Documentation Index

**Complete System Documentation**  
**Generated:** June 16, 2026

---

## 📚 Documentation Files

This folder contains complete documentation for the OptiFleet Vehicle Tracking System with detailed ThingsBoard integration, data flows, and feature specifications.

### 1. **ARCHITECTURE_THINGSBOARD_INTEGRATION.md** ⭐ START HERE
**Purpose:** Complete system architecture and technical overview  
**Contains:**
- System overview and data flow architecture
- ThingsBoard integration with backend services
- Database schema and entity relationships
- Admin dashboard features (all widgets)
- User/Client dashboard features (scoped access)
- Driver app features (personal access)
- Complete API endpoints reference
- ThingsBoard payload structures with examples
- Data flow diagrams (6 detailed diagrams)
- Summary table: Component connections and data sources

**Audience:** Architects, Tech Leads, Senior Developers

**Key Sections:**
- System Overview: How everything connects
- ThingsBoard Integration Architecture: 5 core services explained
- Data Models & Associations: Database schema with relationships
- API Endpoints Reference: All endpoints in table format
- ThingsBoard Payload Structures: 4 payload examples
- Data Flow Diagrams: Pin-to-pin visual flows

---

### 2. **ADMIN_DASHBOARD_GUIDE.md**
**Purpose:** Comprehensive Admin features and usage guide  
**Contains:**
- Dashboard summary widgets (Active/Idle vehicles, drivers, alerts)
- Live fleet map with color-coded markers
- Trip management with detailed ETA calculations
- Recent fleet alerts with severity levels
- Fleet vehicle management
- Fleet driver management with safety scoring
- Driver safety scorecard with algorithm explained
- Notifications center
- System administration options
- Reports and analytics
- Data refresh intervals
- Troubleshooting guide

**Audience:** Fleet Managers (Admin role), System Administrators

**Key Features:**
- Real-time dashboard with 10-second refreshes
- Complete ETA and distance calculation algorithms
- Safety score calculation with point-based system
- 8 different alert types with triggers
- Route deviation detection (>50m threshold)
- Signal health calculation (90%+ = Excellent)

---

### 3. **CLIENT_DASHBOARD_GUIDE.md**
**Purpose:** Client/User dashboard features (scoped to their fleet)  
**Contains:**
- Client authentication and access control
- Dashboard summary (filtered by client_id)
- Fleet map with client-only vehicles
- Vehicle management and telemetry
- Driver management and scorecards
- Trip management and tracking
- Trip history and statistics
- Notifications and alerts
- Settings and preferences
- Offline mode capabilities
- Support and help resources

**Audience:** Fleet Managers (Client role), Operations Managers

**Key Features:**
- All admin features but scoped to client's vehicles only
- Real-time vehicle tracking with 10-second updates
- ETA updates every 5 seconds
- Trip history with analytics
- Multi-period scorecard view (7 days, 30 days, 90 days)

---

### 4. **DRIVER_APP_GUIDE.md**
**Purpose:** Driver mobile app complete usage guide  
**Contains:**
- OTP-based authentication
- Home screen dashboard
- Trip management (create, track, end)
- Live map with real-time position updates
- Turn-by-turn navigation integration
- Real-time ETA calculations
- Alerts and safety monitoring
- Safety score viewing
- Trip history
- Driver profile management
- Offline mode support
- Background location tracking
- Data usage optimization
- Accessibility features

**Audience:** Drivers, Field Operations, Mobile App Users

**Key Features:**
- Live WebSocket updates (5-second intervals)
- Real-time ETA recalculation based on current speed
- 6 types of real-time alerts (overspeed, drowsiness, etc.)
- Personal safety scorecard
- Trip completion summary

---

## 🔗 Pin-to-Pin Component Connections

### Dashboard Widgets → Data Sources

| Widget | Endpoint | Query Type | Refresh |
|--------|----------|-----------|---------|
| Active Vehicles | `/api/dashboard/summary` | ThingsBoard direct | 10s |
| Idle Vehicles | `/api/dashboard/summary` | ThingsBoard direct | 10s |
| Active Drivers | `/api/dashboard/summary` | ThingsBoard + DB | 10s |
| Active Alerts | `/api/dashboard/summary` | ThingsBoard + DB | 10s |
| Live Fleet Map | `/api/dashboard/live-vehicles` | ThingsBoard direct | 10s |
| Trip Management | `/api/trips` | DB + ThingsBoard | 5s |
| Recent Fleet Alerts | `/api/notifications` | ThingsBoard + DB | 5s |
| Vehicle Telemetry | `/api/fleet/vehicles/{id}/telemetry` | ThingsBoard | 10s |
| Driver Scorecard | `/api/fleet/drivers/{id}/scorecard` | DB aggregation | On-demand |

### Real-Time Data Flow

```
[GPS Device in Vehicle]
         ↓ (MQTT telemetry)
[ThingsBoard Server]
         ↓ (Rule Engine trigger)
[OptiFleet Backend: /api/thingsboard/telemetry]
         ↓ (LiveTrackingService processes)
[Database updates + TripStateCache]
         ↓ (WebSocket broadcast)
[Mobile App / Web Dashboard]
         ↓
[Map updated, ETA recalculated, Alerts triggered]
```

---

## 🧮 Key Calculations Explained

### 1. **ETA Calculation**
```
Current Position → Find nearest point on polyline
Remaining Distance = Sum of polyline segments to destination
Current Speed = Latest ThingsBoard telemetry
Remaining Time = Remaining Distance / Current Speed
ETA = current_time + Remaining Time

NOTE: If speed < 5 km/h, use 40 km/h average
```

### 2. **Distance Calculation**
```
Total Distance = OSRM polyline encoded distance
Current Position = Latest GPS from ThingsBoard
Remaining Distance = Haversine distance from current to destination
Progress % = (Total - Remaining) / Total × 100

Haversine Formula: d = 2R × arcsin(√(sin²(Δlat/2) + cos(lat1)×cos(lat2)×sin²(Δlon/2)))
```

### 3. **Safety Score Calculation**
```
BASE = 100 points

DEDUCTIONS (per incident):
  - Smoking: 5 points
  - Mobile Usage: 5 points
  - Overspeed: 5 points
  - Drowsiness: 5 points
  - Seatbelt: 5 points
  - Distraction: 5 points
  - Harsh Acceleration: 3 points
  - Harsh Braking: 3 points

FINAL = MAX(0, BASE - TOTAL_DEDUCTIONS)

GRADE: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)
```

### 4. **Active Vehicle Detection**
```
LIVE = Telemetry timestamp ≤ now - 120 seconds
ACTIVE = trip_status IN ("Moving", "Idle")
Active Vehicle = LIVE ∩ ACTIVE
```

### 5. **Route Deviation Detection**
```
Vehicle Position = Latest ThingsBoard lat/lng
Nearest Point on Route = Haversine closest match
Deviation Distance = Haversine(Vehicle, Nearest)
IS_DEVIATED = Deviation Distance > 50m (configurable)
```

---

## 📊 Data Models

### Core Entities

**Vehicles ↔ Drivers Association:**
```
Vehicle (registration_no = "MH-01-AB-1234")
   ↓ [associations table]
Driver (driver_id, driver_name)
   ↓ [trips table]
Trip (start_time, end_time, custom_polyline)
   ↓ [trip_alerts table]
Alert (alert_type, lat, lng, timestamp)
   ↓ [vtelemetry table]
Latest Telemetry (speed, lat, lng, ts)
```

**ThingsBoard Link:**
```
Vehicle.registration_no = ThingsBoard Device.name
Device.attributes.client_id = Client ID
Device telemetry = {lat, lng, speed, trip_status, ...}
```

---

## 🚀 Real-Time Features

### WebSocket Updates
- **Endpoint:** `WS /topic/live-tracking/{vehicleId}`
- **Frequency:** Every 5 seconds
- **Data:** Position, speed, ETA, trip status
- **Source:** LiveTrackingService (processes telemetry)

### Alert Broadcasting
- **Endpoint:** `WS /topic/alerts`
- **Frequency:** Real-time (on trigger)
- **Data:** Alert type, vehicle, driver, location, severity
- **Source:** ThingsBoard rule engine → webhook → service

---

## 🔐 Access Control & Scoping

### Admin Access
- ✓ All vehicles across all clients
- ✓ All drivers across all clients
- ✓ All trips and alerts
- ✓ System administration
- ✓ User management

### Client Access
- ✓ Own vehicles only (`WHERE client_id = ?`)
- ✓ Own drivers only (`WHERE client_id = ?`)
- ✓ Own trips and alerts only
- ✗ Cannot see other clients
- ✗ No system administration

### Driver Access
- ✓ Own assigned vehicle only
- ✓ Own trips only
- ✓ Own safety scorecard
- ✓ Own alerts
- ✗ Cannot see other drivers
- ✗ Cannot see other vehicles

---

## 📱 Mobile App Architecture

```
┌─────────────────────────────────────┐
│  React Native (TypeScript)          │
├─────────────────────────────────────┤
│  Navigation Layer                   │
│  ├─ AuthNavigator                   │
│  ├─ DriverNavigator                 │
│  ├─ AdminNavigator                  │
│  └─ AppNavigator (main)             │
├─────────────────────────────────────┤
│  Screen Components                  │
│  ├─ Dashboard                       │
│  ├─ Fleet Map                       │
│  ├─ Trips                           │
│  ├─ Alerts                          │
│  └─ Driver Profile                  │
├─────────────────────────────────────┤
│  Services Layer                     │
│  ├─ API Client (Axios)              │
│  ├─ Authentication Service          │
│  ├─ Dashboard Service               │
│  ├─ Fleet Service                   │
│  ├─ Trip Service                    │
│  └─ WebSocket Service               │
├─────────────────────────────────────┤
│  Hooks & State Management           │
│  ├─ useAuth                         │
│  ├─ useAlertNotifications           │
│  └─ Redux Store (if used)           │
├─────────────────────────────────────┤
│  External Integrations              │
│  ├─ React Native Maps               │
│  ├─ WebSocket                       │
│  └─ Device Storage                  │
└─────────────────────────────────────┘
```

---

## 🔧 Backend Architecture

```
┌─────────────────────────────────────┐
│  Spring Boot Application            │
├─────────────────────────────────────┤
│  Controllers                        │
│  ├─ DashboardController             │
│  ├─ FleetController                 │
│  ├─ FleetDriverController           │
│  ├─ TripsController                 │
│  ├─ NotificationController          │
│  └─ ThingsBoardWebhookController    │
├─────────────────────────────────────┤
│  Services                           │
│  ├─ ThingsBoardAuthService          │
│  ├─ ThingsBoardDeviceService        │
│  ├─ ThingsBoardDirectQueryService   │
│  ├─ LiveTrackingService             │
│  ├─ DashboardService                │
│  ├─ TripsService                    │
│  └─ AuthService                     │
├─────────────────────────────────────┤
│  Schedulers                         │
│  ├─ TelemetryPollingScheduler       │
│  └─ AlertScheduler                  │
├─────────────────────────────────────┤
│  In-Memory Caching                  │
│  ├─ TripStateCache                  │
│  ├─ DeviceIdCache                   │
│  └─ GeocodeCache                    │
├─────────────────────────────────────┤
│  Repositories (Spring Data JPA)     │
│  ├─ VehicleRepository               │
│  ├─ DriverRepository                │
│  ├─ TripRepository                  │
│  └─ TripAlertRepository             │
├─────────────────────────────────────┤
│  Database (PostgreSQL)              │
│  └─ [Schema with relationships]     │
├─────────────────────────────────────┤
│  External APIs                      │
│  ├─ ThingsBoard REST API            │
│  ├─ OSRM Routing API                │
│  └─ Nominatim Geocoding API         │
└─────────────────────────────────────┘
```

---

## 📈 Performance Metrics

### Data Refresh Rates
- Dashboard Summary: 10 seconds
- Live Map: 10 seconds
- Trip Progress: 5 seconds
- Alerts: Real-time (WebSocket)
- ETA Recalculation: 5 seconds
- Trip History: On-demand

### Thresholds
- LIVE Data: ≤120 seconds old
- Route Deviation: >50 meters
- Overspeed: >80 km/h
- Idle Status: <5 km/h
- Signal Health: Based on 50 recent readings

### Timeouts
- ThingsBoard Connect: 3 seconds
- ThingsBoard Read: 5 seconds
- JWT Token Expiry: 3480 seconds (58 minutes)

---

## 🔄 Alert Types & Severity

| Alert Type | Severity | Source | Frequency |
|-----------|----------|--------|-----------|
| OVERSPEED | High | Telemetry | Per-incident |
| DROWSINESS | Critical | AI Model | Per-incident |
| SMOKING | Medium | AI Model | Per-incident |
| MOBILE_USAGE | Medium | AI Model | Per-incident |
| ROUTE_DEVIATION | Low | Calculation | Per-incident |
| SEATBELT | High | Sensor | Per-incident |
| HARSH_ACCELERATION | Medium | Sensor | Per-incident |
| HARSH_BRAKING | Medium | Sensor | Per-incident |

---

## 🛠️ Configuration Parameters

**Suggested Defaults:**

| Parameter | Default | Configurable |
|-----------|---------|--------------|
| Overspeed Threshold | 80 km/h | Yes (per vehicle) |
| Route Deviation Threshold | 50 meters | Yes (per vehicle) |
| LIVE Data Threshold | 120 seconds | Yes (global) |
| Polling Interval (Mobile) | 10 seconds | Yes (per app) |
| ETA Refresh Rate | 5 seconds | Yes (per trip) |
| Average Speed Fallback | 40 km/h | Yes (global) |
| ThingsBoard Connect Timeout | 3 seconds | Yes (config) |
| ThingsBoard Read Timeout | 5 seconds | Yes (config) |

---

## 📚 How to Use This Documentation

### For New Developers
1. Start with **ARCHITECTURE_THINGSBOARD_INTEGRATION.md** (System Overview section)
2. Read relevant role-specific guide (Admin/Client/Driver)
3. Study API Endpoints Reference
4. Review Data Flow Diagrams

### For Feature Development
1. Find feature in role-specific guide
2. Check Data Sources section
3. Review API endpoint details
4. Understand data refresh rate
5. Check thresholds/calculations if applicable

### For Debugging
1. Check Troubleshooting section in relevant guide
2. Review ThingsBoard Payload Structures
3. Check Data Flow Diagrams
4. Verify API endpoint parameters

### For Deployment
1. Review Configuration Parameters
2. Set ThingsBoard connection details
3. Configure alert thresholds
4. Set data refresh rates
5. Configure external API keys (OSRM, Nominatim)

---

## 🔗 Related Resources

- **Backend Code:** `/vts-backend/src/main/java/com/vts/`
- **Mobile Code:** `/vts-mobile/src/`
- **Database Migrations:** `/vts-backend/db/`
- **API Documentation:** Swagger UI at `http://localhost:8080/swagger-ui.html`

---

## 📞 Document Maintenance

**Last Updated:** June 16, 2026  
**Version:** 1.0  
**Status:** Complete

**Future Updates:**
- Add screenshots/wireframes
- Add sequence diagrams
- Add deployment guide
- Add performance tuning guide
- Add troubleshooting flowcharts

---

## ✅ Document Coverage

- ✓ System architecture explained
- ✓ ThingsBoard integration (5 services)
- ✓ Data models and relationships
- ✓ All dashboard widgets documented
- ✓ All API endpoints listed
- ✓ ETA calculations explained
- ✓ Distance calculations explained
- ✓ Safety score algorithm
- ✓ Real-time data flows
- ✓ Alert types and triggers
- ✓ Three user roles covered
- ✓ Mobile app features
- ✓ Backend architecture
- ✓ Data refresh rates
- ✓ Troubleshooting guides
- ✓ Best practices

---

**OptiFleet: Complete System Documentation**  
**All Components Pin-to-Pin Connected Through ThingsBoard**
