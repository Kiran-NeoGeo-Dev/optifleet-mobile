# OptiFleet Mobile App — User Manual

**Version:** 1.0.0  
**Platform:** Android  
**Package:** com.neogeo.vtsmobile  
**Built With:** React Native (Expo) · Leaflet Maps · OpenStreetMap

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Application Overview](#2-application-overview)
3. [System Requirements](#3-system-requirements)
4. [Installation](#4-installation)
5. [Login & Registration](#5-login--registration)
6. [Dashboard Overview](#6-dashboard-overview)
7. [Feature Guide](#7-feature-guide)
8. [User Roles](#8-user-roles)
9. [Alerts & Notifications](#9-alerts--notifications)
10. [Real-World Applications](#10-real-world-applications)
11. [Benefits](#11-benefits)
12. [FAQ](#12-faq)
13. [Troubleshooting](#13-troubleshooting)
14. [Contact & Support](#14-contact--support)

---

## 1. Introduction

### Purpose of the App

OptiFleet is a professional **Vehicle Tracking System (VTS)** mobile application designed to give fleet managers, administrators, and drivers real-time visibility and control over their entire vehicle fleet. It combines live GPS tracking, driver behavior monitoring, trip management, and alert notifications into a single, easy-to-use mobile platform.

### Target Users

| User Type | Who They Are |
|-----------|-------------|
| **Super Admin** | Top-level system administrator managing multiple organizations |
| **Admin** | Fleet manager or company administrator managing their own fleet |
| **User (Client)** | Business user who monitors their assigned fleet |
| **Driver** | Vehicle operator who uses the app for navigation and trip tracking |

---

## 2. Application Overview

### What the App Does

OptiFleet connects to a backend server to provide:
- **Real-time GPS tracking** of all fleet vehicles on an interactive map
- **Driver behavior monitoring** — overspeed, smoking, mobile usage, drowsiness, harsh braking, harsh acceleration, rash turning, and route deviation
- **Trip management** — create, assign, track, and complete trips with route planning
- **Fleet management** — manage vehicles, drivers, devices, and associations
- **Instant alerts** — push-style notifications for safety violations and fleet events

### Key Features

- Live fleet map with vehicle status (Moving / Idle / Parked)
- Real-time dashboard with 4 key stat cards
- Trip live tracking with progress bar, ETA, and remaining distance
- Driver scorecard and performance analytics
- Vehicle and driver management (add, edit, delete, import)
- Device management with Excel/CSV bulk import
- Notification center with severity-based alert classification
- Role-based access control (Super Admin / Admin / User / Driver)
- Voice guidance for drivers (route deviation warnings, ETA announcements)
- Admin recovery (password reset via registered email)
- System overview for Super Admins (enterprise-level analytics)

---

## 3. System Requirements

### Android
- Android 8.0 (API level 26) or higher
- Minimum 2 GB RAM recommended
- Active internet connection (Wi-Fi or mobile data)
- GPS / Location services enabled

### iOS
- iOS support is available (tablet not supported per configuration)
- iOS 13.0 or higher recommended

### Required Permissions

| Permission | Purpose |
|-----------|---------|
| Internet | API communication and live map tiles |
| Location | GPS tracking for drivers |
| Camera / Gallery | Driver photo upload |
| Storage | File import (Excel/CSV for bulk data) |
| Microphone | Voice guidance (text-to-speech) |
| Notifications | Real-time fleet alerts |

---

## 4. Installation

### Step 1 — Download the APK
Obtain the OptiFleet APK file from your system administrator or the official distribution channel.

### Step 2 — Enable Unknown Sources (Android)
1. Go to **Settings → Security**
2. Enable **"Install from Unknown Sources"** or **"Install Unknown Apps"**
3. Select your file manager or browser as the trusted source

### Step 3 — Install the App
1. Open the downloaded `.apk` file
2. Tap **Install**
3. Wait for installation to complete
4. Tap **Open**

### Step 4 — First Launch
- The app opens to the **Login Screen**
- Ensure your device has an active internet connection
- Contact your administrator for login credentials

---

## 5. Login & Registration

### Login Screen

The login screen supports three role types. Select the correct role tab before entering credentials.

#### Role Tabs

| Tab | Icon | Login Method |
|-----|------|-------------|
| **Admin** | Shield icon | Username + Password |
| **User** | Business icon | Username + Password |
| **Driver** | Car icon | Mobile Number + Date of Birth |

---

### Admin / User Login

**Steps:**
1. Open the app — the Login screen appears automatically
2. Tap the **Admin** or **User** tab at the top of the login card
3. Enter your **Username**
4. Enter your **Password** (tap the eye icon to show/hide)
5. Optionally check **Remember me**
6. Tap **Sign In**

**Expected Result:** A success toast appears — "Login successful! Welcome to OptiFleet." — and you are redirected to your dashboard.

**Error Handling:**
- Wrong credentials → "Invalid username or password."
- Wrong role selected → "Invalid credentials for [Role]. Please select the correct role."
- Empty fields → "Please enter username and password."

---

### Driver Login

**Steps:**
1. Tap the **Driver** tab
2. Enter your **Mobile Number** (10 digits)
3. Enter your **Date of Birth** in DD/MM/YYYY format
   - You can type it manually (auto-formats as you type)
   - Or tap the calendar icon to use the date picker
4. Tap **Sign In**

**Expected Result:** Redirected to the Driver Map screen showing your active trip.

---

### Forgot Password (Admin Recovery)

**Steps:**
1. On the Login screen, tap **Forgot Password?**
2. The **Admin Recovery** screen opens
3. Fill in the following fields:
   - **Registered Email** — your account email (used for verification)
   - **New Username** — the username you want to use
   - **New Password** — minimum 6 characters
   - **Confirm Password** — must match New Password
   - **Full Name** (optional)
   - **Phone Number** (optional, with country code picker)
4. Tap **Reset Credentials**
5. On success, you are redirected back to Login

**Note:** This feature is for Admin accounts only. Driver credentials are managed by the administrator.

---

## 6. Dashboard Overview

### Admin Dashboard

After Admin login, the **Admin Dashboard** is the home screen.

#### Header Area
| Element | Description |
|---------|-------------|
| Hamburger menu (☰) | Opens the right-side profile/settings drawer |
| Notification bell (🔔) | Opens the Notifications screen; shows a red badge with unread count |
| Title | "OptiFleet Admin Dashboard" |

#### 4 Stat Cards (tap to navigate)

| Card | Color | Navigates To |
|------|-------|-------------|
| Active Vehicles | Green | Fleet Vehicles screen |
| Idle Vehicles | Orange | Fleet Vehicles screen |
| Active Drivers | Blue | Fleet Drivers screen |
| Active Alerts | Red | Notifications screen |

Cards auto-refresh every 5 seconds.

#### Live Fleet Map
- Interactive Leaflet map embedded via WebView
- Vehicle markers colored by status: 🟢 Moving · 🟡 Idle · 🔴 Parked
- Tap any vehicle marker to see a popup with: Vehicle ID, Trip Status, Driver, Speed, Address, Coordinates, Last Update, and all behavior flags
- Tap the **expand icon** (⤢) to open the Full Map screen

#### Trip Management Card
- Tap to navigate to the Trip Management screen
- Shows "Route logistics & geofence monitoring"

#### System Overview Card *(Super Admin only)*
- Visible only when logged in as Super Admin
- Tap to navigate to the System Overview screen

#### Recent Fleet Alerts
- Shows up to 6 live (unresolved) alerts
- Color-coded by severity: 🔴 HIGH · 🟡 MEDIUM · 🔵 INFO
- Tap any alert or "View all" to open the Notifications screen

---

### User Dashboard

Identical layout to Admin Dashboard with the following differences:
- Title shows "OptiFleet User Dashboard"
- No System Overview card
- Same 4 stat cards, live map, trip management, and alerts

---

### Bottom Navigation Bar

Both Admin and User dashboards share the same bottom navigation bar:

| Tab | Icon | Action |
|-----|------|--------|
| Dashboard | Pulse | Go to Dashboard |
| Management | Grid | Opens Management Drawer (slide-in) |
| **+** (FAB) | Plus | Opens Create Drawer (slide-in) |
| Vehicles | Bus | Go to Fleet Vehicles |
| Drivers | People | Go to Fleet Drivers |

---

### Management Drawer (slide from left)

Accessible via the **Management** tab or by tapping the hamburger menu.

**Admin Management Drawer items:**
- Users — All registered users
- Drivers — All registered drivers
- Vehicles — All registered vehicles
- Associations — Driver-vehicle associations
- Devices — Device management
- Trips — Trip management

**User Management Drawer items:**
- Total Vehicles
- Total Drivers
- Associations

---

### Create Drawer (FAB +)

Tap the center **+** button to open the Create Drawer.

**Admin Create options:**
- Add Driver
- Add Vehicle
- Register Trip
- Add Device
- Create Client/User

**User Create options:**
- Add Driver
- Add Vehicle
- Register Trip

---

## 7. Feature Guide

---

### 7.1 Vehicle Management

**Purpose:** Add, view, edit, and delete vehicles in the fleet.

**How to Access:**
- Bottom bar → **Vehicles** tab → Fleet Vehicles screen
- Management Drawer → **Total Vehicles** → Vehicle List screen

#### View Fleet Vehicles

**Steps:**
1. Tap **Vehicles** in the bottom navigation bar
2. The Fleet Vehicles screen loads all vehicles with live status
3. Each card shows: Vehicle registration number, assigned driver, and status badge (Moving / Idling / Parked / Offline)
4. Use the search bar to filter by vehicle number or driver name
5. Pull down to refresh manually
6. Tap **View ›** on any vehicle to open Vehicle Details

**Vehicle Details Screen shows:**
- Live status, speed, driver name
- All behavior flags (overspeed, smoking, mobile usage, drowsiness, route deviation, harsh braking, harsh acceleration, rash turning)
- Last known location and coordinates
- Last update time

#### Add a Vehicle

**Steps:**
1. Tap the **+** FAB → **Add Vehicle**
2. Fill in the vehicle form:
   - License Plate (required)
   - Vehicle Make (e.g., Tata, Ashok Leyland)
   - Vehicle Model
   - Vehicle Type
   - Status (Active / Inactive)
   - Vehicle Photo (optional — tap to upload from gallery)
3. Tap **Save**

**Expected Result:** Vehicle is added and appears in the vehicle list.

#### Edit a Vehicle

**Steps:**
1. Go to Vehicle List (Management Drawer → Total Vehicles)
2. Find the vehicle and tap **Edit**
3. Modify the required fields
4. Tap **Update**

#### Delete a Vehicle

1. Go to Vehicle List
2. Tap **Delete** on the vehicle card
3. Confirm in the dialog

---

### 7.2 Driver Management

**Purpose:** Add, view, edit, delete drivers, and manage their photos.

**How to Access:**
- Bottom bar → **Drivers** tab → Fleet Drivers screen
- Management Drawer → **Total Drivers** → Driver List screen

#### View Fleet Drivers

**Steps:**
1. Tap **Drivers** in the bottom navigation bar
2. Each driver card shows: Name, phone number, license number, status
3. Tap any driver to open their **Driver Scorecard**

#### Driver Scorecard

Shows performance analytics for a specific driver:
- Total trips, distance covered
- Behavior violation counts (overspeed, harsh braking, etc.)
- Safety score

#### Add a Driver

**Steps:**
1. Tap **+** FAB → **Add Driver**
2. Fill in the driver form:
   - Driver Name (required)
   - Phone Number
   - License Number
   - License Expiry Date
   - Aadhar Number
   - Status (Active / Inactive)
   - Username and Password (for driver app login)
   - Comments
3. Tap **Next** → **Driver Photos** screen opens
4. Upload driver photos:
   - Front Face Photo
   - Side Face Photo
   - License Front
   - License Back
5. Tap **Submit**

**Expected Result:** Driver is created with photos and appears in the driver list.

#### Edit a Driver

1. Go to Driver List
2. Tap **Edit** on the driver card
3. Modify fields → Tap **Update**
4. To update photos: tap **Edit Photos**

#### View Driver Photos

1. Go to Driver List
2. Tap **View Photos** on any driver card to see all uploaded photos

---

### 7.3 Device Management *(Admin only)*

**Purpose:** Register and manage GPS/tracking devices assigned to clients.

**How to Access:**
- Management Drawer → **Devices**
- Create Drawer → **Add Device**

#### View Devices

Each device card shows:
- Device ID
- Status badge (Active / Inactive)
- Device Model
- Mobile Number and IMEI Number
- Action buttons: View · Edit · Delete

#### Add a Device

**Steps:**
1. Open Device Management → tap **+** or use Create Drawer
2. Select the **Client** to assign the device to (Admin only)
3. Fill in:
   - Device ID (required)
   - Mobile Number (10 digits, required)
   - IMEI Number (15 digits, required)
   - Device Model (required)
   - Device Type (default: MOBILE)
   - Status (Active / Inactive)
4. Tap **Register Device**

#### Bulk Import Devices (Excel / CSV)

**Steps:**
1. Open the Add Device form
2. Tap **Import Excel / CSV**
3. Select your file from device storage
4. The app parses the file and creates devices row by row

**Required CSV/Excel columns:**
`DeviceId`, `MobileNumber`, `IMEINumber`, `DeviceModel`, `DeviceType`, `Status`

**Expected Result:** An import result modal shows total rows, successful imports, and any failures with row numbers and reasons.

---

### 7.4 Association Management

**Purpose:** Link drivers to vehicles so the system knows which driver is operating which vehicle.

**How to Access:**
- Management Drawer → **Associations**

#### View Associations

Lists all driver-vehicle pairs with:
- Driver name and vehicle registration
- Association status
- Created date

#### Create an Association

**Steps:**
1. Go to Association List
2. Tap **+** (Add Association)
3. Select a **Driver** from the dropdown
4. Select a **Vehicle** from the dropdown
5. Tap **Save**

**Expected Result:** The driver is now linked to the vehicle. Live tracking will show the driver's name on the vehicle marker.

---

### 7.5 Trip Management

**Purpose:** Create, monitor, edit, and delete trips with route planning and live tracking.

**How to Access:**
- Dashboard → **Trip Management** card
- Create Drawer → **Register Trip**

#### View All Trips

The Trip Management screen shows all trips with:
- Trip ID
- Status badge (Not Started / In Progress / Completed / Delayed)
- Route: Start Place → End Place
- Vehicle ID and Driver Name
- Distance (km) and Duration
- Action buttons: Track · Edit · Delete (Admin only)

**Filter trips by status:**
1. Tap the **Filter** button (top right of search bar)
2. Select a status from the picker modal
3. The list updates instantly

**Search trips:**
- Type in the search bar to filter by Trip ID, Vehicle, or Driver name

#### Register a Trip

**Steps:**
1. Tap **+** FAB → **Register Trip**
2. Fill in:
   - Trip ID (auto-generated or custom)
   - Vehicle (select from list)
   - Driver (select from list)
   - Start Location (search or pin on map)
   - End Location (search or pin on map)
   - Planned End Time (optional)
3. The app calculates the route using OSRM (road-following route)
4. Tap **Register**

**Expected Result:** Trip appears in the list with status "Not Started".

#### Edit a Trip

1. Find the trip in the list
2. Tap **Edit**
3. Modify fields → Tap **Update**

#### Live Track a Trip

1. Find the trip in the list
2. Tap **Track**
3. The **Trip Live Tracking** screen opens

---

### 7.6 Trip Live Tracking

**Purpose:** Monitor a trip in real time with live vehicle position, route progress, and behavior alerts.

**Screen Elements:**

| Element | Description |
|---------|-------------|
| Header | Trip ID, Vehicle ID, Driver Name |
| OFF ROUTE badge | Appears in red when vehicle deviates from planned route |
| Bell icon | Opens the in-screen alert notification panel |
| Info Bar | REMAINING distance · ETA · SPEED · PROGRESS % |
| Progress Bar | Visual fill showing % of trip completed |
| Map | Live Leaflet map with route polyline and vehicle marker |
| Route Bar | FROM location → TO location at the bottom |

**How to use:**
1. Tap the vehicle label on the map to open the **Vehicle Popup**
2. The popup shows all live telemetry: speed, behavior flags, address, coordinates, last update time
3. The info bar updates every 5 seconds
4. The route polyline shrinks as the vehicle progresses
5. Tap the bell icon to view in-trip alerts

---

### 7.7 Fleet Vehicles Screen

**Purpose:** View all vehicles with their live status in a searchable list.

**Steps:**
1. Tap **Vehicles** in the bottom navigation bar
2. Browse the list — each card shows registration number, driver, and status
3. Search by vehicle number or driver name
4. Tap **View ›** to open Vehicle Details with full live telemetry

---

### 7.8 Fleet Drivers Screen

**Purpose:** View all drivers with their current assignment and performance.

**Steps:**
1. Tap **Drivers** in the bottom navigation bar
2. Browse the driver list
3. Tap any driver to open their **Driver Scorecard**

---

### 7.9 Full Map Screen

**Purpose:** View all fleet vehicles on a full-screen interactive map.

**How to Access:**
- Dashboard → tap the **expand icon** (⤢) on the Live Fleet Map

**Features:**
- All vehicles shown as colored emoji markers (🚛)
- Green = Moving, Yellow = Idle, Red = Parked
- Tap any marker to see the vehicle popup with full telemetry
- Pinch to zoom, drag to pan

---

### 7.10 Notifications Screen

**Purpose:** View, manage, and clear all fleet alerts.

**How to Access:**
- Dashboard → tap the **bell icon** (top right)
- Any stat card → **Active Alerts**

#### Notification Card Elements

| Element | Description |
|---------|-------------|
| Left color bar | Severity color (Red = HIGH, Yellow = MEDIUM, Blue = INFO) |
| Emoji icon | Alert type icon |
| Alert title | Type of violation (e.g., OVERSPEED) |
| Vehicle · Driver | Which vehicle and driver triggered the alert |
| Detail text | Additional context |
| Time | When the alert was triggered |
| Unread dot | Blue dot on unread notifications |

#### Actions

| Button | Action |
|--------|--------|
| Mark read | Marks all notifications as read |
| Clear | Removes all notifications from the list |
| Filter | (UI present — filter by type) |
| Tap a card | Marks that specific notification as read |

---

### 7.11 Admin User Management *(Admin only)*

**Purpose:** Create, view, edit, and delete user accounts.

**How to Access:**
- Management Drawer → **Users**

#### View All Users

Each user card shows:
- Avatar with initials
- Full name and role badge (ADMIN / USER)
- Email address and phone number
- Action buttons: View · Edit · Delete

#### Create a Client/User

**Steps:**
1. Create Drawer → **Create Client**
2. Fill in user details: full name, username, password, email, phone, role
3. Tap **Save**

#### Edit a User

1. User List → tap **Edit** on a user card
2. Modify fields → Tap **Update**

#### View User Details

1. User List → tap **View** on a user card
2. Full profile is shown in read-only mode

---

### 7.12 System Overview *(Super Admin only)*

**Purpose:** Enterprise-level analytics across all organizations.

**How to Access:**
- Admin Dashboard → **System Overview** card (visible to Super Admin only)

#### Key Metrics (horizontal scroll cards)

| Metric | Description |
|--------|-------------|
| Organizations | Total number of registered organizations |
| Users | Total users across all organizations |
| Devices | Total registered devices |
| Vehicles | Total vehicles |
| Drivers | Total drivers |

#### Organization Cards

Each organization card shows:
- Organization ID
- Owner Name and Username
- Created Date
- Users, Devices, Vehicles, Drivers count

**Search:** Filter organizations by name, username, or Org ID using the search bar.

---

### 7.13 Driver App — Live Map *(Driver role)*

**Purpose:** Drivers see their active trip on a map with navigation guidance.

**Screen Elements:**

| Element | Description |
|---------|-------------|
| Header | "Live Map" title + deviation badge + bell + logout |
| Driver overlay card | Driver photo, name, vehicle ID, active status (top-right of map) |
| Info Bar | VEHICLE · REMAINING · ETA · SPEED |
| Progress bar | Trip completion percentage |
| Map | Route polyline with truck icon at start, red pin at destination |
| Route Bar | FROM → TO at the bottom |

**Features:**
- Live position updates every 5 seconds
- Voice guidance every 5 minutes: "Continue on route. X km remaining. ETA Y minutes."
- Route deviation warning: "Warning! You have deviated from the planned route."
- Tap the vehicle label on the map to see full telemetry popup
- Tap the driver overlay card to open Driver Profile

**No Active Trip State:**
- If no trip is assigned, the screen shows "No Active Trip" with a message to contact the dispatcher

---

### 7.14 Driver Profile *(Driver role)*

**Purpose:** Drivers can view their own profile information.

**How to Access:**
- Driver Map → tap the driver overlay card (top-right of map)
- Driver Map → tap the avatar in the header

Shows: Driver name, phone, license details, status, and uploaded photos.

---

## 8. User Roles

### Super Admin
- Full access to all features
- Can view System Overview (enterprise analytics across all organizations)
- Can manage all users, drivers, vehicles, devices, trips
- Sees all organizations and their data

### Admin
- Full access to their organization's fleet
- Can create/manage users (clients), drivers, vehicles, devices, associations, trips
- Can view all notifications and alerts
- Cannot access System Overview

### User (Client)
- Can view their assigned fleet
- Can manage drivers, vehicles, associations, and trips
- Cannot create new user accounts
- Cannot access Device Management or System Overview

### Driver
- Sees only their own active trip on the Driver Map
- Receives voice guidance and deviation alerts
- Can view their own profile
- Cannot access any management screens

---

## 9. Alerts & Notifications

### Alert Types and Severity

| Alert | Emoji | Severity | Color |
|-------|-------|----------|-------|
| Overspeed | 🚨 | HIGH | Red |
| Smoking | 🚭 | HIGH | Red |
| Harsh Braking | 🛑 | HIGH | Red |
| Mobile Usage | 📱 | MEDIUM | Yellow |
| Route Deviation | 📍 | MEDIUM | Yellow |
| Harsh Acceleration | ⚡ | MEDIUM | Yellow |
| Rash Turning | ↪️ | MEDIUM | Yellow |
| Drowsiness | 😴 | INFO | Blue |

### How Alerts Work

1. The backend detects a violation from the vehicle's telemetry device
2. The alert is pushed to the notification service
3. The dashboard polls every 5 seconds and updates the **Active Alerts** count
4. The notification bell badge shows the unread count
5. In-trip alerts appear as toast notifications at the top of the screen
6. A bell sound plays for new alerts (audio notification)

### In-Trip Alert Notifications (Live Tracking & Driver Map)

During active trip tracking, alerts appear as:
- **Toast banners** at the top of the screen (auto-dismiss after a few seconds)
- **Bell history panel** — tap the bell icon to see all alerts for the current trip
- Alerts can be dismissed individually or all at once

### Notification Actions

| Action | How |
|--------|-----|
| Mark single as read | Tap the notification card |
| Mark all as read | Tap "Mark read" button in header |
| Clear all | Tap "Clear" button in header |
| View alert details | Tap the card to see vehicle and driver info |

---

## 10. Real-World Applications

### Industries

| Industry | Use Case |
|----------|---------|
| **Logistics & Delivery** | Track delivery trucks, monitor driver behavior, optimize routes |
| **School Transportation** | Monitor school buses, ensure safe driving, alert parents |
| **Construction** | Track heavy equipment and site vehicles |
| **Public Transport** | Monitor bus fleets, track schedules, manage drivers |
| **Corporate Fleets** | Manage company car pools, track employee travel |
| **Mining & Oil & Gas** | Monitor vehicles in remote or hazardous areas |
| **Agriculture** | Track farm vehicles and equipment across large areas |
| **Emergency Services** | Monitor ambulances, fire trucks, and response vehicles |

### Specific Use Cases

- **Route Compliance:** Ensure drivers follow approved routes; get instant alerts on deviations
- **Driver Safety:** Detect and report dangerous driving behaviors in real time
- **Fuel Management:** Identify idle vehicles to reduce fuel waste
- **Maintenance Scheduling:** Track vehicle usage to plan preventive maintenance
- **Incident Investigation:** Review trip history and behavior logs after an incident
- **Regulatory Compliance:** Maintain driver logs and vehicle records for audits

---

## 11. Benefits

### Business Benefits

- **Reduced Fuel Costs** — Identify and eliminate unnecessary idling and inefficient routes
- **Lower Insurance Premiums** — Documented safe driving records can reduce insurance costs
- **Improved Productivity** — Real-time visibility means faster response to delays and issues
- **Asset Protection** — Know where every vehicle is at all times; detect unauthorized use
- **Customer Satisfaction** — Accurate ETAs and on-time deliveries improve customer trust

### Operational Benefits

- **Centralized Control** — Manage your entire fleet from a single mobile app
- **Instant Alerts** — React to safety violations and route deviations immediately
- **Data-Driven Decisions** — Driver scorecards and trip analytics guide training and policy
- **Paperless Operations** — Digital trip registration and driver records replace manual logs
- **Scalability** — Supports multiple organizations and hundreds of vehicles

### Safety Benefits

- **Driver Accountability** — Drivers know their behavior is monitored, encouraging safer driving
- **Fatigue Detection** — Drowsiness alerts help prevent accidents caused by tired drivers
- **Distraction Prevention** — Mobile usage alerts discourage phone use while driving
- **Speed Control** — Overspeed alerts enforce speed limits in real time

---

## 12. FAQ

**Q: Can multiple users log in at the same time?**  
A: Yes. Each user has their own account and can log in simultaneously from different devices.

**Q: How often does the map update?**  
A: The live map and dashboard stats refresh every 5 seconds automatically.

**Q: What happens if a driver has no active trip?**  
A: The Driver Map screen shows a "No Active Trip" message. The driver should contact their dispatcher.

**Q: Can I use the app without an internet connection?**  
A: No. OptiFleet requires an active internet connection to communicate with the backend server and load map tiles.

**Q: How do I reset my password?**  
A: Tap "Forgot Password?" on the Login screen and use the Admin Recovery form with your registered email address.

**Q: Can I import multiple vehicles or drivers at once?**  
A: Yes. Device Management supports bulk import via Excel or CSV files. Contact your administrator for the required column format.

**Q: What does the "OFF ROUTE" badge mean?**  
A: It means the vehicle has deviated from the planned trip route. The driver will also receive a voice warning.

**Q: How do I assign a driver to a vehicle?**  
A: Go to Management Drawer → Associations → Create a new association linking the driver and vehicle.

**Q: Can drivers see their own performance data?**  
A: Drivers can view their profile. Detailed scorecards are visible to Admins and Users in the Fleet Drivers section.

**Q: What file formats are supported for bulk import?**  
A: Excel (.xlsx) and CSV (.csv) files are supported.

---

## 13. Troubleshooting

### Login Issues

| Problem | Solution |
|---------|---------|
| "Invalid username or password" | Double-check credentials. Ensure Caps Lock is off. |
| "Invalid credentials for [Role]" | Make sure you selected the correct role tab (Admin / User / Driver) |
| App shows blank screen after login | Check internet connection. Force close and reopen the app. |
| Driver cannot log in | Verify mobile number (10 digits) and date of birth format (DD/MM/YYYY) |

### Map Issues

| Problem | Solution |
|---------|---------|
| Map shows blank/grey tiles | Check internet connection. The map requires OpenStreetMap tile access. |
| Vehicles not showing on map | Ensure devices are active and sending telemetry. Check with your administrator. |
| Map is frozen / not updating | Pull to refresh on the dashboard, or navigate away and back. |

### Notification Issues

| Problem | Solution |
|---------|---------|
| No alerts showing | Alerts only appear when the backend detects violations. If fleet is operating normally, no alerts is expected. |
| Bell badge not updating | The dashboard polls every 5 seconds. Wait a moment or navigate away and back. |
| Sound not playing for alerts | Check device volume and ensure the app has audio permissions. |

### Performance Issues

| Problem | Solution |
|---------|---------|
| App is slow or laggy | Close other background apps. Ensure device has sufficient free RAM. |
| Trip tracking not updating | Check internet connection. The tracking polls every 5 seconds. |
| Photos not uploading | Ensure the app has camera/storage permissions in device settings. |

### Data Issues

| Problem | Solution |
|---------|---------|
| Vehicle list is empty | Ensure vehicles have been added by an Admin. Check your role permissions. |
| Trip not appearing after creation | Refresh the Trip Management screen by navigating away and back. |
| Import failed | Check that your Excel/CSV file has the correct column headers and data format. |

### General

| Problem | Solution |
|---------|---------|
| App crashes on startup | Uninstall and reinstall the app. Contact support if the issue persists. |
| Logged out unexpectedly | Your session may have expired. Log in again. |
| "Network error — check backend is running" | The server may be down. Contact your system administrator. |

---

## 14. Contact & Support

For technical support, feature requests, or account issues, contact the OptiFleet support team:

| Channel | Details |
|---------|---------|
| **Email** | support@neogeo.in |
| **Phone** | +91 XXXXX XXXXX |
| **Website** | www.neogeo.in |
| **App Version** | 1.0.0 |
| **Package** | com.neogeo.vtsmobile |

### When Contacting Support, Please Provide:
- Your username and role (Admin / User / Driver)
- Device model and Android version
- A description of the issue
- Screenshot or screen recording if possible
- The time the issue occurred

---

*This document covers OptiFleet Mobile App version 1.0.0. Features and screens may vary in future updates.*

*© 2024 NeoGeo. All rights reserved.*
