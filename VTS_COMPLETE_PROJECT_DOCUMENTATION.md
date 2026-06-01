# OptiFleet — VTS Mobile App
## Complete Project Documentation & Deployment Guide

**Developed by:** NeoGeoInfo Technologies Ltd  
**App Name:** OptiFleet (Vehicle Tracking System)  
**Version:** 1.0.0  
**Date:** April 2026

---

## 1. PROJECT OVERVIEW

OptiFleet is a mobile application for managing drivers and vehicles in a fleet tracking system. It connects to a Spring Boot backend which reads data from a PostgreSQL database and integrates with ThingsBoard IoT platform for live telemetry.

---

## 2. TECHNOLOGY STACK

| Layer | Technology | Version |
|---|---|---|
| Mobile App | React Native (Expo) | SDK 55 |
| Language (Mobile) | TypeScript | 5.4.0 |
| Backend | Spring Boot | 3.2.4 |
| Language (Backend) | Java | 17 |
| Database | PostgreSQL | 16.x |
| IoT Platform | ThingsBoard | - |
| Authentication | JWT (JSON Web Token) | - |
| Android Package | com.neogeo.vtsmobile | - |
| Expo Owner | maradana | - |
| Expo Project ID | d2a2a4d4-d3a7-4e96-a144-1a5ab467cf5d | - |

---

## 3. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                        │
│              http://vtsweb.neogeoinfo.in:8787               │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API (JSON over HTTP)
                      │ JWT Bearer Token in headers
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              SPRING BOOT BACKEND (Port 8787)                │
│                  vtsweb.neogeoinfo.in                       │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│   PostgreSQL DB      │   │        ThingsBoard IoT           │
│  192.168.1.146:5432  │   │  Primary:  192.168.1.146:8282    │
│  thingsboard_vts     │   │  Fallback: 183.82.114.29:8282    │
│  user: vts_user      │   │  user: kiran.m@neogeoinfo.com    │
└──────────────────────┘   └──────────────────────────────────┘
```

---

## 4. SERVER & CONNECTION DETAILS

### Backend Server
| Property | Value |
|---|---|
| Public URL | http://vtsweb.neogeoinfo.in:8787 |
| Local URL | http://192.168.1.199:8787 |
| Port | 8787 |
| JWT Expiry | 24 hours (86400000 ms) |

### Database
| Property | Value |
|---|---|
| Host | 192.168.1.146 |
| Port | 5432 |
| Database | thingsboard_vts |
| Username | vts_user |
| Password | vts@thingsboard |

### ThingsBoard IoT
| Property | Value |
|---|---|
| Primary Host | 192.168.1.146:8282 |
| Fallback Host | 183.82.114.29:8282 |
| Username | kiran.m@neogeoinfo.com |
| Password | NeoGeo@321 |
| Telemetry Key | state = STARTED (for active count) |

---

## 5. DATABASE TABLES

### 5.1 clients
Stores login credentials and profile of all app users.

```sql
CREATE TABLE public.clients (
    client_id    BIGSERIAL PRIMARY KEY,
    username     VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,          -- BCrypt hashed
    full_name    VARCHAR(150),
    email_address VARCHAR(150),
    dial_code    VARCHAR(10),
    phone_number VARCHAR(20),
    role         VARCHAR(50),                    -- Admin / Client / Driver
    role_description TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 drivers
Stores all driver records.

```sql
CREATE TABLE public.drivers (
    id             SERIAL PRIMARY KEY,
    driver_name    VARCHAR(16) NOT NULL,
    license_no     VARCHAR(16) NOT NULL UNIQUE,
    license_expiry DATE NOT NULL,
    phone_number   CHAR(10) NOT NULL,
    aadhaar_number CHAR(12) NOT NULL UNIQUE,
    status         BOOLEAN DEFAULT true,         -- true=Active, false=Inactive
    photo_front    TEXT,                         -- Base64 encoded image
    photo_left     TEXT,                         -- Base64 encoded image
    photo_right    TEXT,                         -- Base64 encoded image
    created_at     TIMESTAMP DEFAULT now(),
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 vehicles
Stores all vehicle records.

```sql
CREATE TABLE public.vehicles (
    id                   SERIAL PRIMARY KEY,
    registration_no      VARCHAR(10) NOT NULL UNIQUE,
    date_of_registration DATE NOT NULL,
    registration_validity DATE NOT NULL,
    chassis_number       VARCHAR(20) NOT NULL UNIQUE,
    engine_number        VARCHAR(20) NOT NULL UNIQUE,
    owner_name           VARCHAR(20) NOT NULL,
    vehicle_make         VARCHAR(16) NOT NULL,
    vehicle_model        VARCHAR(16) NOT NULL,
    manufacturing_date   DATE NOT NULL,
    fuel_type            VARCHAR(10) NOT NULL,   -- Petrol/Diesel/CNG/Electric
    insurance_number     VARCHAR(20) NOT NULL UNIQUE,
    insurance_date       DATE NOT NULL,
    last_puc_date        DATE,
    puc_due_on           DATE,
    photo                TEXT,                   -- Base64 encoded image
    created_at           TIMESTAMP DEFAULT now(),
    device_id            INTEGER REFERENCES devices(id) ON DELETE SET NULL
);
```

---

## 6. LOGIN CREDENTIALS

All passwords are BCrypt hashed in the database.

| Username | Password | Role | Full Name |
|---|---|---|---|
| admin | admin123 | Admin | NeoGeo Administrator |
| client1 | admin123 | Client | Ramesh Kumar |
| client2 | admin123 | Client | Suresh Patel |
| client3 | admin123 | Client | Priya Nair |
| driver1 | admin123 | Driver | Ravi Shankar |
| driver2 | admin123 | Driver | Mohan Das |
| manager1 | admin123 | Admin | Arjun Mehta |

---

## 7. API ENDPOINTS — COMPLETE REFERENCE

**Base URL:** `http://vtsweb.neogeoinfo.in:8787`  
**Authentication:** All endpoints except `/api/auth/login` and `/api/auth/forgot-password-message` require:
```
Header: Authorization: Bearer <JWT_TOKEN>
```

---

### 7.1 AUTH ENDPOINTS
**Controller File:** `src/main/java/com/vts/controller/AuthController.java`  
**Base Path:** `/api/auth`

---

#### POST /api/auth/login
**Purpose:** Authenticate user and get JWT token  
**Auth Required:** No  
**Mobile Screen:** LoginScreen  

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "clientId": 3,
  "username": "admin"
}
```

**Error Response (401):**
```json
{
  "error": "Invalid username or password"
}
```

---

#### GET /api/auth/client-details
**Purpose:** Get logged-in user's profile details  
**Auth Required:** Yes  
**Mobile Screen:** ClientDetailsScreen  

**Success Response (200):**
```json
{
  "id": 3,
  "username": "admin",
  "fullName": "NeoGeo Administrator",
  "emailAddress": "admin@neogeo.in",
  "dialCode": "+91",
  "phoneNumber": "9000000000",
  "role": "Admin",
  "roleDescription": "System administrator..."
}
```

---

#### GET /api/auth/forgot-password-message
**Purpose:** Returns a static message for forgot password  
**Auth Required:** No  
**Mobile Screen:** LoginScreen (Forgot Password button)  

**Success Response (200):**
```
"Please contact NeoGeo Info Technologies Ltd to reset your credentials."
```

---

#### POST /api/auth/setup-test-credentials
**Purpose:** Resets and recreates default test users in the database  
**Auth Required:** No  
**⚠️ WARNING:** Deletes ALL existing clients — use only for initial setup  

**Success Response (200):**
```json
{
  "status": "SUCCESS",
  "message": "All test credentials created with proper BCrypt hashing",
  "credentials": [
    { "username": "client1", "password": "password123", "client_id": "1" },
    { "username": "client2", "password": "password123", "client_id": "2" },
    { "username": "admin",   "password": "admin123",    "client_id": "3" }
  ]
}
```

---

### 7.2 DASHBOARD ENDPOINTS
**Controller File:** `src/main/java/com/vts/controller/DashboardController.java`  
**Base Path:** `/api/dashboard`

---

#### GET /api/dashboard/summary
**Purpose:** Get dashboard statistics — total/active drivers and vehicles  
**Auth Required:** Yes  
**Mobile Screen:** DashboardScreen (4 stat cards)  
**Data Sources:**
- `totalDrivers` → PostgreSQL `drivers` table count
- `totalVehicles` → PostgreSQL `vehicles` table count
- `activeDrivers` → ThingsBoard telemetry (`state = STARTED`)
- `activeVehicles` → ThingsBoard telemetry (`state = STARTED`)

**Success Response (200):**
```json
{
  "totalDrivers": 11,
  "activeDrivers": 3,
  "totalVehicles": 10,
  "activeVehicles": 3
}
```

---

#### GET /api/dashboard/drivers
**Purpose:** Get all drivers list for dashboard  
**Auth Required:** Yes  
**Mobile Screen:** DashboardScreen (internal use)  

**Success Response (200):** Array of Driver objects

---

#### GET /api/dashboard/vehicles
**Purpose:** Get all vehicles list for dashboard  
**Auth Required:** Yes  
**Mobile Screen:** DashboardScreen (internal use)  

**Success Response (200):** Array of Vehicle objects

---

### 7.3 DRIVER ENDPOINTS
**Controller File:** `src/main/java/com/vts/controller/DriverController.java`  
**Base Path:** `/api/drivers`

---

#### POST /api/drivers
**Purpose:** Create a new driver with photos  
**Auth Required:** Yes  
**Mobile Screen:** DriverPhotosScreen (final submit after Add Driver form)  

**Request Body:**
```json
{
  "driverName": "Ravi Kumar",
  "phoneNumber": "9876543210",
  "licenseNumber": "AP0920230012345",
  "licenseExpiry": "2028-03-15",
  "aadharNumber": "123456789012",
  "status": "ACTIVE",
  "frontFaceImage": "<base64_string>",
  "leftFaceImage": "<base64_string>",
  "rightFaceImage": "<base64_string>"
}
```

**Success Response (200):** Created Driver object  
**Error Response (400):** Validation errors  
**Error Response (500):** Database constraint violation (duplicate license/aadhar)

---

#### GET /api/drivers
**Purpose:** Get all drivers list  
**Auth Required:** Yes  
**Mobile Screen:** DriverListScreen  

**Success Response (200):**
```json
[
  {
    "id": 1,
    "driverName": "Ravi Kumar",
    "phoneNumber": "9876543210",
    "licenseNumber": "AP0920230012345",
    "licenseExpiry": "2028-03-15",
    "aadharNumber": "123456789012",
    "status": true,
    "frontFaceImage": "<base64>",
    "leftFaceImage": "<base64>",
    "rightFaceImage": "<base64>",
    "createdAt": "2026-04-01T07:00:00",
    "updatedAt": "2026-04-01T07:00:00"
  }
]
```

---

#### GET /api/drivers/{id}
**Purpose:** Get a single driver by ID  
**Auth Required:** Yes  
**Mobile Screen:** EditDriverScreen (loads existing data)  

**Path Parameter:** `id` — Driver ID (integer)  

**Success Response (200):** Single Driver object  
**Error Response (404):** Driver not found

---

#### PUT /api/drivers/{id}
**Purpose:** Update an existing driver's details and/or photos  
**Auth Required:** Yes  
**Mobile Screens:**
- EditDriverScreen → "Save Driver Details" button
- EditDriverPhotosScreen → "Resubmit Driver Details" button

**Path Parameter:** `id` — Driver ID (integer)  

**Request Body:** Same as POST /api/drivers  

**Success Response (200):** Updated Driver object  
**Error Response (404):** Driver not found

---

### 7.4 DRIVER PHOTOS ENDPOINT
**Controller File:** `src/main/java/com/vts/controller/DriverPhotoController.java`  
**Base Path:** `/api/driver-photos`

---

#### GET /api/driver-photos/{driverId}
**Purpose:** Get face photos of a specific driver  
**Auth Required:** Yes  
**Mobile Screen:** ViewDriverPhotosScreen  

**Path Parameter:** `driverId` — Driver ID (integer)  

**Success Response (200):**
```json
{
  "frontFaceImage": "<base64_string_or_null>",
  "leftFaceImage":  "<base64_string_or_null>",
  "rightFaceImage": "<base64_string_or_null>"
}
```

**Error Response (404):** Driver not found

---

### 7.5 VEHICLE ENDPOINTS
**Controller File:** `src/main/java/com/vts/controller/VehicleController.java`  
**Base Path:** `/api/vehicles`

---

#### POST /api/vehicles
**Purpose:** Register a new vehicle  
**Auth Required:** Yes  
**Mobile Screen:** AddVehicleScreen  

**Request Body:**
```json
{
  "licensePlate": "AP09AB1234",
  "manufactureDate": "2023-01-15",
  "registrationValidity": "2028-01-15",
  "chassisNumber": "MA3FJEB1S00123456",
  "engineNumber": "K12M1234567",
  "ownerName": "Ramesh Kumar",
  "vehicleMake": "Maruti Suzuki",
  "vehicleModel": "Swift",
  "dateOfManufacturing": "2022-11-10",
  "fuelType": "Petrol",
  "insuranceNumber": "INS2023001234",
  "vehicleInsuranceDate": "2026-01-15",
  "lastPucDate": "2025-12-01",
  "pucDueOn": "2026-06-01",
  "vehiclePhoto": "<base64_string>"
}
```

**Success Response (200):** Created Vehicle object  
**Error Response (400):** Validation errors  
**Error Response (500):** Duplicate registration/chassis/engine/insurance number

---

#### GET /api/vehicles
**Purpose:** Get all vehicles list  
**Auth Required:** Yes  
**Mobile Screen:** VehicleListScreen  

**Success Response (200):**
```json
[
  {
    "id": 1,
    "licensePlate": "AP09AB1234",
    "dateOfRegistration": "2023-01-15",
    "registrationValidity": "2028-01-15",
    "chassisNumber": "MA3FJEB1S00123456",
    "engineNumber": "K12M1234567",
    "ownerName": "Ramesh Kumar",
    "vehicleMake": "Maruti Suzuki",
    "vehicleModel": "Swift",
    "dateOfManufacturing": "2022-11-10",
    "fuelType": "Petrol",
    "insuranceNumber": "INS2023001234",
    "insuranceDate": "2026-01-15",
    "lastPucDate": "2025-12-01",
    "pucDueOn": "2026-06-01",
    "vehiclePhoto": "<base64>",
    "createdAt": "2026-04-01T07:00:00"
  }
]
```

---

#### GET /api/vehicles/{id}
**Purpose:** Get a single vehicle by ID  
**Auth Required:** Yes  
**Mobile Screen:** EditVehicleScreen (loads existing data)  

**Path Parameter:** `id` — Vehicle ID (integer)  

**Success Response (200):** Single Vehicle object  
**Error Response (404):** Vehicle not found

---

#### PUT /api/vehicles/{id}
**Purpose:** Update an existing vehicle's details  
**Auth Required:** Yes  
**Mobile Screen:** EditVehicleScreen → "Update Vehicle Details" button  

**Path Parameter:** `id` — Vehicle ID (integer)  

**Request Body:** Same as POST /api/vehicles  

**Success Response (200):** Updated Vehicle object  
**Error Response (404):** Vehicle not found

---

## 8. API ENDPOINTS SUMMARY TABLE

| # | Method | Endpoint | Auth | Mobile Screen | Purpose |
|---|---|---|---|---|---|
| 1 | POST | /api/auth/login | ❌ | LoginScreen |      Login & get JWT token |
| 2 | GET | /api/auth/client-details | ✅ | ClientDetailsScreen |      Get logged-in user profile |
| 3 | GET | /api/auth/forgot-password-message | ❌ | LoginScreen |     Forgot password message |
| 4 | POST | /api/auth/setup-test-credentials | ❌ | — |          Reset test users (setup only) |
| 5 | GET | /api/dashboard/summary | ✅ | DashboardScreen |       Stats: total/active drivers & vehicles |
| 6 | GET | /api/dashboard/drivers | ✅ | DashboardScreen |       All drivers list |
| 7 | GET | /api/dashboard/vehicles | ✅ | DashboardScreen |      All vehicles list |
| 8 | POST | /api/drivers | ✅ | DriverPhotosScreen |             Create new driver |
| 9 | GET | /api/drivers | ✅ | DriverListScreen |                List all drivers |
| 10 | GET | /api/drivers/{id} | ✅ | EditDriverScreen |          Get driver by ID |
| 11 | PUT | /api/drivers/{id} | ✅ | EditDriverScreen / EditDriverPhotosScreen |    Update driver |
| 12 | GET | /api/driver-photos/{driverId} | ✅ | ViewDriverPhotosScreen |    Get driver face photos |
| 13 | POST | /api/vehicles | ✅ | AddVehicleScreen |      Create new vehicle |
| 14 | GET | /api/vehicles | ✅ | VehicleListScreen |      List all vehicles |
| 15 | GET | /api/vehicles/{id} | ✅ | EditVehicleScreen |     Get vehicle by ID |
| 16 | PUT | /api/vehicles/{id} | ✅ | EditVehicleScreen |     Update vehicle |

---

## 9. MOBILE APP SCREEN → API MAPPING

| Screen | API Calls Made |
|---|---|
| LoginScreen | POST /api/auth/login |
| DashboardScreen | GET /api/dashboard/summary |
| ClientDetailsScreen | GET /api/auth/client-details |
| DriverListScreen | GET /api/drivers |
| AddDriverScreen | (no API — navigates to DriverPhotosScreen) |
| DriverPhotosScreen | POST /api/drivers |
| EditDriverScreen | GET /api/drivers/{id}, PUT /api/drivers/{id} |
| EditDriverPhotosScreen | PUT /api/drivers/{id} |
| ViewDriverPhotosScreen | GET /api/driver-photos/{driverId} |
| VehicleListScreen | GET /api/vehicles |
| AddVehicleScreen | POST /api/vehicles |
| EditVehicleScreen | GET /api/vehicles/{id}, PUT /api/vehicles/{id} |

---

## 10. AUTHENTICATION FLOW

```
1. User opens app → LoginScreen
2. Enters username + password
3. POST /api/auth/login
4. Backend validates BCrypt password against DB
5. Returns JWT token (valid 24 hours)
6. Token stored in app memory (useAuth hook)
7. All subsequent requests include:
   Authorization: Bearer <token>
8. Token expires → user must login again
```

---

## 11. THINGSBOARD INTEGRATION FLOW

```
GET /api/dashboard/summary
        │
        ├── totalDrivers  → SELECT COUNT(*) FROM drivers
        ├── totalVehicles → SELECT COUNT(*) FROM vehicles
        │
        ├── activeDrivers  ─┐
        └── activeVehicles ─┤→ ThingsBoardService
                             │
                             ├── 1. Try primary: http://192.168.1.146:8282
                             │      GET /api/v1/health (timeout 3s)
                             │      If fails → use fallback
                             │
                             ├── 2. Fallback: http://183.82.114.29:8282
                             │
                             ├── 3. POST /api/auth/login
                             │      { username, password } → JWT token
                             │
                             └── 4. POST /api/entitiesQuery/find
                                    Filter: DEVICE where state = STARTED
                                    Returns: totalElements (active count)
                                    If TB unreachable → returns 0 (no crash)
```

---

## 12. DEPLOYMENT STEPS

### Step 1 — Prerequisites
```
Java 17+          → https://adoptium.net
Maven 3.9+        → https://maven.apache.org
Node.js 18+       → https://nodejs.org
PostgreSQL 16+    → https://www.postgresql.org
Expo CLI          → npm install -g expo-cli
EAS CLI           → npm install -g eas-cli
```

### Step 2 — Database Setup
```sql
-- Connect as postgres superuser
psql -h 192.168.1.146 -U postgres -d thingsboard_vts

-- Grant permissions to vts_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vts_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vts_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vts_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vts_user;
```

### Step 3 — Backend Configuration
File: `C:\VTS\vts-backend\src\main\resources\application.properties`
```properties
spring.datasource.url=jdbc:postgresql://192.168.1.146:5432/thingsboard_vts
spring.datasource.username=vts_user
spring.datasource.password=vts@thingsboard
server.port=8787
tb.host.primary=192.168.1.146
tb.port.primary=8282
tb.host.fallback=183.82.114.29
tb.port.fallback=8282
tb.username=kiran.m@neogeoinfo.com
tb.password=NeoGeo@321
```

### Step 4 — Build & Run Backend
```bash
cd C:\VTS\vts-backend

# Build
mvn clean install -DskipTests

# Run
mvn spring-boot:run

# OR run JAR directly
java -Duser.timezone=UTC -jar target\vts-backend-0.0.1-SNAPSHOT.jar
```

Backend starts at: `http://localhost:8787`

### Step 5 — Mobile App Configuration
File: `C:\VTS\vts-mobile\src\config\apiConfig.ts`
```typescript
// For production (public domain)
export const API_BASE_URL = "http://vtsweb.neogeoinfo.in:8787";

// For local testing (replace with your machine IP)
// export const API_BASE_URL = "http://192.168.1.199:8787";
```

### Step 6 — Run Mobile App (Development)
```bash
cd C:\VTS\vts-mobile

# Install dependencies
npm install

# Start Expo
npx expo start --clear

# Press 'a' for Android emulator
# Or scan QR code with Expo Go app
```

### Step 7 — Build APK (Android)
```bash
cd C:\VTS\vts-mobile

# Login to Expo
eas login
# Username: maradana

# Build preview APK (install directly on device)
eas build --platform android --profile preview

# Build production AAB (Google Play Store)
eas build --platform android --profile production
```

Download built APK from: https://expo.dev/accounts/maradana/projects/vts-mobile/builds

---

## 13. IMPORTANT FILES REFERENCE

| File | Location | Purpose |
|---|---|---|
| API URL config | `vts-mobile/src/config/apiConfig.ts` |     Change backend URL here |
| DB config | `vts-backend/src/main/resources/application.properties` |     DB + ThingsBoard + port config |
| App config | `vts-mobile/app.json` |       App name, package, Expo project ID |
| EAS build config | `vts-mobile/eas.json` |     APK build profiles |
| JWT security | `vts-backend/src/main/java/com/vts/security/` |     JWT filter, service, config |
| ThingsBoard service | `vts-backend/src/main/java/com/vts/service/ThingsBoardService.java` |     TB integration |

---

## 14. TOAST NOTIFICATION SYSTEM

All confirmation/response messages use colored bottom toasts (no white popups):

| Color | Type | When Used |
|---|---|---|
| 🟢 Green | success | Driver added, Driver updated, Vehicle added, Vehicle updated, Login success |
| 🔴 Red | error | Failed to create/update, Network errors, Login failed |
| 🟡 Amber | warning | Required field missing, Camera permission denied |
| 🔵 Blue | info | Forgot password, Informational messages |

Toast component: `vts-mobile/src/components/Toast.tsx`

---

## 15. TROUBLESHOOTING

| Problem | Cause | Fix |
|---|---|---|
| Login fails 401 | Wrong password | Use `admin123` for all users |
| Login fails 500 | DB permission denied | Run GRANT ALL on clients table |
| Login fails network error | Wrong API URL or backend not running | Check `apiConfig.ts` URL and start backend |
| Backend fails to start — timezone error | JVM timezone `Asia/Calcutta` not in Ubuntu PostgreSQL | Run with `-Duser.timezone=UTC` |
| Backend fails to start — port in use | Previous instance still running | Kill process on port 8787 |
| ThingsBoard returns 0 | TB server unreachable or wrong credentials | Check TB host/port/credentials in `application.properties` |
| APK can't connect to backend | Device not on same network or wrong IP | Use public domain `vtsweb.neogeoinfo.in` |

---

## 16. NAVIGATION FLOW

```
LoginScreen
    └── Dashboard
          ├── Total Drivers card → DriverListScreen
          │       └── Edit button → EditDriverScreen
          │                └── Continue to Retake Photos → EditDriverPhotosScreen
          │       └── View Photos button → ViewDriverPhotosScreen
          │
          ├── Total Vehicles card → VehicleListScreen
          │       └── Edit button → EditVehicleScreen
          │
          ├── Avatar button → ClientDetailsScreen
          │
          └── FAB (+) button
                ├── Add Driver → AddDriverScreen
                │       └── Continue → DriverPhotosScreen
                └── Add Vehicle → AddVehicleScreen
```

---

*Document prepared by NeoGeoInfo Technologies Ltd*  
*OptiFleet — Vehicle Tracking System v1.0.0*
