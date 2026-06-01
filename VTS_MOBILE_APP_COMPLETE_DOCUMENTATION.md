# OptiFleet VTS — Complete Mobile App Documentation
# Pin-to-Pin Flow: Every Screen, Every Logic, Every Role

---

## 1. APP ENTRY POINT — HOW THE APP DECIDES WHERE TO GO

When the app launches, `AppNavigator` checks the auth state:

```
No token?         → Show LoginScreen
token + role=driver  → Show DriverNavigator  (DriverMapScreen only)
token + isAdmin      → Show AdminNavigator   (Admin flow)
token + isClient     → Show MainNavigator    (Client flow)
```

The token and role are stored in memory via `AuthContext` (useAuth hook).
They are set on successful login and cleared on logout.

---

## 2. LOGIN SCREEN

**File:** `src/screens/auth/LoginScreen.tsx`
**API:** `POST /api/auth/login`

### What the user sees
- NeoGeoInfo Technologies Ltd company logo
- OptiFleet title
- Username field
- Password field (with show/hide toggle)
- Remember Me checkbox
- Forgot Password link
- "Login As" dropdown — Admin / Client / Driver
- Login button

### Logic
1. User enters username + password, selects role (Admin / Client / Driver)
2. App calls `POST /api/auth/login` with `{ username, password }`
3. Backend checks:
   - First looks in `public.drivers` table (for Driver login)
   - Then looks in `public.clients` table (for Admin / Client login)
4. Backend returns `{ token, clientId, username, role }`
5. App validates: if returned `role` does not match selected "Login As" → shows error
6. On success → stores token + role in AuthContext → AppNavigator routes to correct navigator

### Forgot Password
- Shows toast: "Contact NeoGeoInfo Technologies Ltd to reset your password."
- No API call — contact-based reset only

### Role Routing After Login
| Role returned | Navigator loaded |
|---|---|
| Admin | AdminNavigator → AdminDashboardScreen |
| Client | MainNavigator → DashboardScreen |
| Driver | DriverNavigator → DriverMapScreen |

---

## 3. ADMIN FLOW — COMPLETE

### 3.1 Admin Dashboard

**File:** `src/screens/admin/AdminDashboardScreen.tsx`
**API:** `GET /api/dashboard/summary` (auto-refreshes every 30 seconds)

### What admin sees
- OptiFleet branding + "Admin Dashboard" title
- Logout button (top left)
- Avatar/Profile button (top right) → opens Admin Profile
- "Create New Client" button (top)
- 6 stat cards:
  - Total Drivers → taps → AdminDriverListScreen
  - Total Vehicles → taps → AdminVehicleListScreen
  - Active Drivers (no tap)
  - Active Vehicles (no tap)
  - Total Devices → taps → DeviceManagementScreen
  - Associations → taps → AssociationListScreen
- Trip Management card → taps → TripManagementScreen
- FAB (+) button — always visible

### Dashboard Summary Logic
- Backend `GET /api/dashboard/summary` reads from JWT token
- Admin token → returns counts across ALL clients (global)
- Client token → returns counts for that client only
- Counts: totalDrivers, activeDrivers, totalVehicles, activeVehicles, totalDevices, totalAssociations, totalTrips

---

### 3.2 Admin Profile

**File:** `src/screens/admin/AdminProfileScreen.tsx`
**API:** `GET /api/auth/client-details`

- Shows admin's own profile: username, email, phone, role, role description
- Read-only view, no editing

---

### 3.3 Create New Client

**File:** `src/screens/admin/CreateClientScreen.tsx`
**API:** `POST /api/auth/create-client`

### Fields
- Username (min 3 chars)
- Password (min 6 chars)
- Client Full Name
- Email Address
- Phone Number (10 digits, starts 6–9)
- Role (default: "Client")
- Role Description (optional)

### Logic
- Admin fills form → validates all fields → calls API
- Backend creates a new row in `public.clients` table
- New client can now log in with these credentials
- On success → navigates back to Admin Dashboard

---

### 3.4 Admin FAB (+) Menu

When admin taps FAB, a menu appears with:

| Option | Navigates To |
|---|---|
| Add Driver | AddDriverScreen |
| Add Vehicle | AddVehicleScreen |
| Add Device | DeviceManagementScreen (openAddModal=true) |
| Add Association | AssociationListScreen (openAddModal=true) |
| Register Trip | RegisterTripScreen |

---

### 3.5 Admin Driver List

**File:** `src/screens/admin/AdminDriverListScreen.tsx`
**API:** `GET /api/drivers` (returns ALL drivers across all clients for admin)

- Search by name or phone
- Each card shows: name, status (Active/Inactive), phone
- Actions per card:
  - Photos → ViewDriverPhotosScreen
  - Edit → EditDriverScreen
  - Delete → calls `DELETE /api/drivers/{id}` with confirm dialog

---

### 3.6 Admin Vehicle List

**File:** `src/screens/admin/AdminVehicleListScreen.tsx`
**API:** `GET /api/vehicles` (returns ALL vehicles across all clients for admin)

- Search by registration, owner, make
- Each card shows: registration plate, owner, make/model, fuel type, status
- Actions: Edit → EditVehicleScreen

---

## 4. ADD DRIVER — FULL FLOW (Admin + Client)

**Files:**
- `src/screens/driver/AddDriverScreen.tsx`
- `src/screens/driver/DriverPhotosScreen.tsx`

**APIs:**
- `POST /api/drivers`

### Step 1 — AddDriverScreen

**If Admin:** Shows "SELECT CLIENT *" dropdown at top (ClientSelector component)
- Admin must pick a client from `public.clients` (searchable by name, username, ID)
- Admins are filtered out — only client accounts shown

**All users fill:**
- Driver Name (3–50 chars, letters + spaces only)
- Username (3–50 chars, alphanumeric + underscore)
- Password (min 6 chars)
- Phone Number (10 digits, starts 6–9)
- Driving License Number (10–18 alphanumeric)
- Aadhaar Number (exactly 12 digits)
- License Expiry Date (must be future date)
- Status toggle (ACTIVE / INACTIVE)
- Comments (1–250 chars)

### Validation
- All fields validated before proceeding
- If admin and no client selected → error toast
- If any field invalid → error shown inline

### Step 2 — DriverPhotosScreen

After form validation passes → navigates to DriverPhotosScreen with all form data as params

- Upload 3 face photos:
  - Front Face
  - Left Profile
  - Right Profile
- Each photo: camera or gallery, quality 0.3, cropped to 1:1
- Photos are optional (can submit without them)

### Step 3 — Submit

Calls `POST /api/drivers` with:
```json
{
  "driverName": "...",
  "phoneNumber": "...",
  "licenseNumber": "...",
  "aadharNumber": "...",
  "licenseExpiry": "...",
  "status": "ACTIVE",
  "comments": "...",
  "username": "...",
  "password": "...",
  "frontFaceImage": "base64...",
  "leftFaceImage": "base64...",
  "rightFaceImage": "base64...",
  "clientId": 5   ← only sent when admin selects a client
}
```

### Backend Logic
- If `clientId` is present in request → driver is saved with that `clientId`
- If `clientId` is absent → driver is saved with `clientId` from JWT token
- Driver is saved in `public.drivers` table
- Password is BCrypt hashed before saving
- Driver can now log in with their username/password

---

## 5. EDIT DRIVER

**File:** `src/screens/driver/EditDriverScreen.tsx`
**APIs:** `GET /api/drivers/{id}`, `PUT /api/drivers/{id}`

- Pre-fills all fields from existing driver data
- If Admin → shows ClientSelector (optional — to reassign driver to different client)
- Can update: name, username, password (leave blank to keep existing), phone, license, aadhaar, expiry, status, comments
- Two action buttons:
  - "Continue to Retake Photos" → EditDriverPhotosScreen (to update face photos)
  - "Save Driver Details" → saves immediately without photo update

---

## 6. ADD VEHICLE — FULL FLOW

**File:** `src/screens/vehicle/AddVehicleScreen.tsx`
**API:** `POST /api/vehicles`

### Fields (all required)
- If Admin → ClientSelector at top (must select client)
- Vehicle Registration Number (8–12 alphanumeric)
- Date of Registration (not future)
- Registration Validity (must be future)
- Chassis Number / VIN (exactly 17 chars, no I/O/Q)
- Engine Number (8–20 alphanumeric)
- Owner Name (3–50 chars)
- Vehicle Make (2–30 chars)
- Vehicle Model (2–30 chars)
- Date of Manufacturing (not future)
- Fuel Type selector: Petrol / Diesel / CNG / Electric
- Insurance Number (8–25 alphanumeric)
- Insurance Date
- Last PUC Date (not future)
- PUC Due On (must be after Last PUC Date)
- Vehicle Photo (JPG/PNG, max 2MB, base64)

### Backend Logic
- If `clientId` in request → vehicle saved with that `clientId`
- Else → `clientId` from JWT token
- Saved in `public.vehicles` table

---

## 7. EDIT VEHICLE

**File:** `src/screens/vehicle/EditVehicleScreen.tsx`
**APIs:** `GET /api/vehicles/{id}`, `PUT /api/vehicles/{id}`

- Pre-fills all fields
- If Admin → ClientSelector shown (optional reassign)
- Can update any field including photo
- Saves via `PUT /api/vehicles/{id}`

---

## 8. DEVICE MANAGEMENT

**File:** `src/screens/admin/DeviceManagementScreen.tsx`
**APIs:** `GET /api/devices`, `POST /api/devices`, `PUT /api/devices/{id}`, `DELETE /api/devices/{id}`

### List View
- Search by Device ID, model, or mobile number
- Each card shows: Device ID, model, mobile, IMEI, status (Active/Inactive)
- Actions: View (read-only), Edit, Delete

### Add Device (modal)
- If Admin → ClientSelector shown at top of modal
- Fields:
  - Device ID (unique identifier)
  - Device Type (default: MOBILE)
  - Mobile Number (exactly 10 digits)
  - IMEI Number (exactly 15 digits)
  - Device Model
  - Status toggle

### Backend Logic
- If admin sends `clientId` → device `createdBy` is set to `"client_{id}"`
- Else → `createdBy` set to current user's username
- Saved in `public.devices` table
- Device ID and IMEI must be globally unique

---

## 9. ASSOCIATIONS

**File:** `src/screens/dashboard/AssociationListScreen.tsx`

Associations link a Vehicle + Device + Driver together so the system knows which driver is operating which vehicle with which tracking device.

### Two Modes

**Admin Mode** (`isAdmin = true`):
- Creates Vehicle ↔ Device links (stored in `public.admin_associations`)
- No driver assignment at this level
- Uses `fetchAdminAssociations`, `fetchVehiclesDropdown`, `fetchAvailableDevices`
- Form: Select Vehicle + Select Device

**Client Mode** (`isAdmin = false`):
- Creates Vehicle + Device + Driver associations (stored in `public.associations`)
- Uses `fetchAssociations`, `fetchVehiclesWithDevice`, `fetchDrivers`
- Form: Select Vehicle (auto-fetches linked device) → Select Driver → Country → Status

### Logic Flow (Client Association)
1. Client selects a vehicle → system auto-fetches the device linked to that vehicle
2. Client selects a driver from their driver list
3. Sets country (default: India) and status (Active/Inactive)
4. Saves to `public.associations` with `client_id`

### Why Associations Matter
- Trip creation uses `GET /api/associations/vehicles-for-trip`
- This returns only vehicles that have a valid association (vehicle + device + driver all linked)
- Live tracking validates: vehicle → association → active trip before showing data
- Without an association, a vehicle cannot be assigned to a trip

### Actions
- View (read-only details)
- Edit (update vehicle/device/driver)
- Delete (removes association)

---

## 10. REGISTER TRIP / CREATE TRIP

**File:** `src/screens/dashboard/RegisterTripScreen.tsx`
**APIs:**
- `GET /api/associations/vehicles-for-trip` (fetch eligible vehicles)
- `POST /api/trips` (create trip)
- `GET /api/live-tracking/state/{vehicleId}` (live tracking after creation)

### Prerequisites
A vehicle must have a valid association (vehicle + device + driver) before it appears in the vehicle picker.

### Step 1 — Auto-generated Trip ID
Format: `TRIP-YYYYMMDD-HHMMSS` (e.g., `TRIP-20260420-161850`)
Generated automatically on screen load.

### Step 2 — Select Vehicle
- Dropdown shows all vehicles with valid associations
- Each option shows: registration number + driver name
- Selecting a vehicle auto-fills the Driver Name field

### Step 3 — GPS Auto-detect Start Location
- App requests foreground location permission
- Uses `Location.watchPositionAsync` to get real GPS fix
- Auto-fills "From (Start Point)" with reverse-geocoded address via Nominatim API
- Map centers on user's current location

### Step 4 — Set Route
- From (Start Point): type to search (Nominatim autocomplete) OR tap map pin icon to click on map
- To (Destination): same — type search or map click
- Suggestions show up to 8 results filtered to India

### Step 5 — Auto Route Calculation
- Once both points are set → calls OSRM routing API
- Calculates: distance (km), duration (hours/minutes), polyline coordinates
- Draws blue polyline on Leaflet map
- Voice announcement: "Route selected from X to Y. Total distance is Z km..."

### Step 6 — Confirm & Create Trip
Calls `POST /api/trips` with:
```json
{
  "tripId": "TRIP-20260420-161850",
  "tripName": "TRIP-20260420-161850",
  "vehicleId": "MH12BU5625",
  "driverName": "Dinesh",
  "driverId": 3,
  "startPlace": "Mumbai, Maharashtra",
  "endPlace": "Pune, Maharashtra",
  "startLat": 19.076,
  "startLng": 72.877,
  "endLat": 18.520,
  "endLng": 73.856,
  "distanceKm": 148.5,
  "duration": "2h 45min",
  "customPolyline": "[{lat,lng},...]"
}
```

### Backend Logic
- Checks for duplicate: if same vehicle + driver already has an active trip → returns 409 error
- Sets `status = "Not Started"`
- Sets `clientId` from JWT token
- Saves to `public.trips`

### Step 7 — After Creation
- Success toast shown
- App opens fullscreen map modal
- Starts polling `GET /api/live-tracking/state/{vehicleId}` every 5 seconds
- Shows live stats bar: Remaining KM, ETA, Speed, Progress %

---

## 11. TRIP MANAGEMENT

**File:** `src/screens/trips/TripManagementScreen.tsx`
**API:** `GET /api/trips`

### Access
- Admin → Trip Management card on Admin Dashboard → sees ALL trips across all clients
- Client → Trip Management card on Client Dashboard → sees only their trips

### Screen Layout
- Search bar: search by Trip ID, Vehicle Number, Driver Name
- Status filter dropdown: All / Not Started / In Progress / Completed / Delayed
- Date range (From / To) + Export Report button
- Trip table

### Trip Table Columns
- DETAILS (Trip ID)
- VEHICLE / DRIVER (registration + driver name)
- STATUS (color-coded badge)
- ACTIONS (View / Edit / Delete)

### Trip Status System (Auto-calculated)
Status is NOT manually set. It is calculated dynamically:

```
No telemetry received           → Not Started
Telemetry received, not at dest → In Progress
Vehicle reached destination     → Completed  (distance ≤ 50–100m threshold)
Current time > ETA, not done    → Delayed
```

Status is stored in `public.trips.status` and updated by the system.

### Status Badge Colors
- Not Started → grey
- In Progress → blue
- Completed → green
- Delayed → orange/red

### Export Report
- User selects From Date and To Date
- Clicks "Export Report"
- Calls: `GET http://thingsboard.neogeoinfo.in:9449/api/v1/reports/distance-travelled?from_date=X&to_date=Y`
- Returns distance travelled report for selected date range

### Actions

**View (👁️) → TripLiveTrackingScreen**
- Opens full-screen map
- Shows live vehicle position (from ThingsBoard telemetry)
- Route polyline shrinks as vehicle progresses
- ETA and remaining distance update in real time
- Tap vehicle icon → popup with: Vehicle ID, Driver, Speed, Location, Overspeed, Smoking, Mobile Usage, Drowsiness, Route Deviation

**Edit (✏️) → EditTripScreen**
- Opens same form as Register Trip
- Pre-filled with existing: Start Point, Destination, Vehicle, Driver
- Admin and Client can both edit
- On save: new route calculated, new polyline, distance and ETA recalculated
- Status resets to "Not Started"
- Saved via `PUT /api/trips/{id}`

**Delete (🗑️)**
- Admin → can delete any trip
- Client → DELETE is NOT allowed (button hidden or disabled)
- Calls `DELETE /api/trips/{id}`
- Removes from `public.trips`

### Role-Based Access Summary
| Role | Trips Visible | View | Edit | Delete |
|---|---|---|---|---|
| Admin | All clients | ✅ | ✅ | ✅ |
| Client | Own only | ✅ | ✅ | ❌ |

---

## 12. CLIENT FLOW — COMPLETE

### 12.1 Client Dashboard

**File:** `src/screens/dashboard/DashboardScreen.tsx`
**API:** `GET /api/dashboard/summary`

### What client sees
- OptiFleet branding + "Dashboard" title
- Logout button
- Avatar → ClientDetailsScreen
- 6 stat cards:
  - Total Drivers → DriverListScreen
  - Total Vehicles → VehicleListScreen
  - Active Drivers (no tap)
  - Active Vehicles (no tap)
  - Associations → AssociationListScreen
  - Trip Management → TripManagementScreen
- FAB (+) button — always visible

### Dashboard Summary Logic
- Client JWT token → backend returns counts for that client only
- All data is scoped to `client_id` from JWT

---

### 12.2 Client Details

**File:** `src/screens/dashboard/ClientDetailsScreen.tsx`
**API:** `GET /api/auth/client-details`

- Shows client's own profile: username, full name, email, phone, role, role description
- Read-only

---

### 12.3 Client FAB Menu

| Option | Navigates To |
|---|---|
| Add Driver | AddDriverScreen (no ClientSelector shown) |
| Add Vehicle | AddVehicleScreen (no ClientSelector shown) |
| Add Device | DeviceManagementScreen |
| Add Association | AssociationListScreen |
| Register Trip | RegisterTripScreen |

When client adds data → `clientId` comes from their JWT token automatically.

---

### 12.4 Driver List (Client)

**File:** `src/screens/driver/DriverListScreen.tsx`
**API:** `GET /api/drivers` (returns only this client's drivers)

- Search by name or phone
- Each card: name, status, phone
- Actions: Photos → ViewDriverPhotosScreen, Edit → EditDriverScreen

---

### 12.5 Vehicle List (Client)

**File:** `src/screens/vehicle/VehicleListScreen.tsx`
**API:** `GET /api/vehicles` (returns only this client's vehicles)

- Search by registration, owner, make
- Each card: plate, owner, make/model, fuel type, status
- Actions: Edit → EditVehicleScreen

---

## 13. DRIVER FLOW — COMPLETE

### 13.1 Driver Login

- Driver enters username + password on LoginScreen
- Selects "Driver" in "Login As" dropdown
- Backend checks `public.drivers` table
- Returns token with `driverId` claim embedded in JWT
- AppNavigator routes to DriverNavigator → DriverMapScreen

---

### 13.2 Driver Map Screen

**File:** `src/screens/driver/DriverMapScreen.tsx`
**APIs:**
- `GET /api/trips/driver/active` — fetch assigned trip
- `GET /api/live-tracking/state/{vehicleId}` — poll every 5 seconds

### On Load
1. Calls `GET /api/trips/driver/active`
2. Backend extracts `driverId` from JWT claims
3. Returns the most recent trip for that driver from `public.trips`
4. If no trip → shows "No active trip assigned" message

### Map Display
- Leaflet map rendered in WebView
- Route drawn as blue polyline (from `customPolyline` stored in trip, or recalculated via OSRM)
- 🚚 truck icon at start position
- 📍 red pin at destination

### Live Tracking (every 5 seconds)
Polls `GET /api/live-tracking/state/{vehicleId}`:
- Updates truck icon position on map
- Shrinks route polyline (remaining route only)
- Updates info bar: Vehicle ID, Remaining KM, ETA, Speed

### Info Bar (top)
- Vehicle ID
- Remaining distance
- ETA
- Speed (km/h)

### Progress Bar
- Shows % of trip completed (0–100%)

### Route Bar (bottom)
- FROM: start place name
- → arrow
- TO: destination name

### Voice Guidance
- Every 5 minutes: "Continue on route. X km remaining. ETA Y minutes."
- On route deviation: "Warning! You have deviated from the planned route. Please return to route."
- Uses `expo-speech` with `en-IN` language

### Vehicle Popup (tap vehicle icon on map)
Shows:
- Vehicle ID
- Status
- Driver Name
- Speed
- Location
- Overspeed alert
- Smoking alert
- Mobile Usage alert
- Drowsiness alert
- Route Deviation status

### Logout
- Confirm dialog → clears token → back to LoginScreen

---

## 14. DATA FLOW — HOW EVERYTHING CONNECTS

```
Admin creates Client account
        ↓
Client logs in
        ↓
Client adds Drivers (public.drivers, client_id set)
Client adds Vehicles (public.vehicles, client_id set)
Admin adds Devices (public.devices)
        ↓
Admin creates Vehicle↔Device link (public.admin_associations)
Client creates Vehicle+Device+Driver association (public.associations)
        ↓
Client registers Trip (public.trips)
  - Picks vehicle from associations/vehicles-for-trip
  - Driver auto-fetched from association
  - Route calculated via OSRM
  - Status = "Not Started"
        ↓
Driver logs in → sees their trip → map loads
        ↓
ThingsBoard sends telemetry (lat, lng, speed, alerts)
        ↓
Live tracking state calculated:
  - Remaining route
  - ETA
  - Progress %
  - Alert flags
        ↓
Trip status auto-updated:
  Not Started → In Progress → Completed / Delayed
        ↓
Admin/Client monitors via Trip Management → View (live tracking)
```

---

## 15. BACKEND API — COMPLETE ENDPOINT MAP

| Method | Endpoint | Who Uses It | Purpose |
|---|---|---|---|
| POST | /api/auth/login | All | Login |
| GET | /api/auth/client-details | All | Own profile |
| POST | /api/auth/create-client | Admin | Create client account |
| GET | /api/auth/all-clients | Admin | List all clients (for ClientSelector) |
| GET | /api/dashboard/summary | All | Dashboard counts |
| GET | /api/drivers | Admin/Client | List drivers |
| GET | /api/drivers/{id} | All | Single driver |
| POST | /api/drivers | All | Create driver |
| PUT | /api/drivers/{id} | All | Update driver |
| DELETE | /api/drivers/{id} | Admin | Delete driver |
| GET | /api/vehicles | Admin/Client | List vehicles |
| GET | /api/vehicles/{id} | All | Single vehicle |
| POST | /api/vehicles | All | Create vehicle |
| PUT | /api/vehicles/{id} | All | Update vehicle |
| GET | /api/devices | Admin | List devices |
| POST | /api/devices | Admin | Create device |
| PUT | /api/devices/{id} | Admin | Update device |
| DELETE | /api/devices/{id} | Admin | Delete device |
| GET | /api/associations | Client | List associations |
| POST | /api/associations | Client | Create association |
| PUT | /api/associations/{id} | Client | Update association |
| DELETE | /api/associations/{id} | Client | Delete association |
| GET | /api/associations/vehicles-with-device | Client | Vehicles for association form |
| GET | /api/associations/vehicles-for-trip | All | Vehicles eligible for trip |
| GET | /api/trips | All | List trips |
| POST | /api/trips | All | Create trip |
| PUT | /api/trips/{id} | All | Update trip route |
| DELETE | /api/trips/{id} | Admin | Delete trip |
| GET | /api/trips/driver/active | Driver | Driver's active trip |
| GET | /api/live-tracking/state/{vehicleId} | All | Live tracking data |

---

## 16. DATABASE TABLES USED

| Table | Purpose |
|---|---|
| public.clients | Admin + Client login accounts |
| public.drivers | Driver records (linked to client_id) |
| public.vehicles | Vehicle records (linked to client_id) |
| public.devices | Tracking devices |
| public.admin_associations | Vehicle ↔ Device links (admin level) |
| public.associations | Vehicle + Device + Driver links (client level) |
| public.trips | All trip records with route, ETA, status |
| public.vehicle_tracking | Telemetry data from ThingsBoard |
| public.trip_alerts | Alerts (overspeed, smoking, drowsiness, etc.) |
| public.routes | Pre-defined routes (optional) |

---

## 17. CLIENT SELECTOR — HOW IT WORKS (Admin Only)

**File:** `src/components/ClientSelector.tsx`

When admin opens Add Driver / Add Vehicle / Add Device / Edit Driver / Edit Vehicle:
1. A "SELECT CLIENT *" dropdown appears at the top of the form
2. Tapping it opens a bottom-sheet modal
3. Loads all clients from `GET /api/auth/all-clients`
4. Filters out admin accounts (role = "admin")
5. Shows: Full Name, @username, Client ID
6. Searchable by name, username, or ID
7. Admin selects a client → `clientId` is passed in the API request body
8. Backend uses this `clientId` to assign the data to that client

If admin does NOT select a client → form shows validation error and blocks submission.

---

## 18. ROLE-BASED LOGIC SUMMARY

| Feature | Admin | Client | Driver |
|---|---|---|---|
| See all clients' data | ✅ | ❌ | ❌ |
| Create client accounts | ✅ | ❌ | ❌ |
| Add Driver (with client selector) | ✅ | ✅ (own) | ❌ |
| Add Vehicle (with client selector) | ✅ | ✅ (own) | ❌ |
| Add Device | ✅ | ✅ | ❌ |
| Create Association | ✅ (V+D link) | ✅ (V+D+Driver) | ❌ |
| Register Trip | ✅ | ✅ | ❌ |
| View Trip (live tracking) | ✅ | ✅ | ❌ |
| Edit Trip | ✅ | ✅ | ❌ |
| Delete Trip | ✅ | ❌ | ❌ |
| Delete Driver | ✅ | ❌ | ❌ |
| See live map + route | ❌ | ❌ | ✅ |
| Voice navigation | ❌ | ❌ | ✅ |

---

## 19. KEY TECHNICAL DETAILS

### Authentication
- JWT tokens stored in memory (AuthContext)
- Token sent as `Authorization: Bearer {token}` on every API call
- Token contains: `clientId`, `driverId` (for drivers), `role`
- Admin token → backend returns global data
- Client token → backend scopes data to `client_id`

### Maps
- Leaflet.js rendered inside React Native WebView
- Tile layer: OpenStreetMap
- Routing: OSRM (open source routing machine)
- Geocoding/Autocomplete: Nominatim API (India-filtered)
- Communication: WebView ↔ React Native via `postMessage` / `injectJavaScript`

### Live Tracking
- Polls `GET /api/live-tracking/state/{vehicleId}` every 5 seconds
- Backend reads latest telemetry from ThingsBoard
- Returns: lat, lng, speed, remaining route, ETA, progress %, alert flags
- Map updated by injecting JavaScript into WebView

### Voice Guidance (Driver only)
- Uses `expo-speech` with `en-IN` locale
- Triggered: on route set (announces route), every 5 minutes (progress update), on deviation (warning)

### Photo Handling
- All photos stored as base64 strings in database
- Max size: 2MB for vehicle photos, 5MB for driver face photos
- Driver face photos: 3 angles (front, left, right) for facial recognition

---

*Document generated from live codebase — D:\VTS\vts-mobile + D:\VTS\vts-backend*
