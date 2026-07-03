# Driver Safety Score Overview

## Goal
Explain how the driver safety score is calculated in the backend and displayed in the mobile app.

The score is a percentage between 0% and 100%:
- **100%** = Safest Driver
- **0%** = Highest Risk Driver

---

## What exists in the mobile app

### 1. Fleet driver list screen
- File: `vts-mobile/src/screens/fleet/FleetDriversScreen.tsx`
- Shows each driver's current monthly safety score as a percentage (e.g. `93.6%`).
- Tapping a driver opens the scorecard screen.

### 2. Driver scorecard screen
- File: `vts-mobile/src/screens/fleet/DriverScorecardScreen.tsx`
- Shows detailed safety score for one driver and one month.
- Displays: safety score %, remark, all 9 event counts, km driven.

---

## Backend implementation

### Controller
- File: `vts-backend/src/main/java/com/vts/controller/FleetDriverController.java`
- Handles `GET /api/fleet/drivers` and `GET /api/fleet/drivers/{id}/scorecard`

### Data source
- Telemetry: `public.tb_device_telemetry` (column `telemetry_time` for date filter)
- Distance: `public.trips` (column `start_time` for date filter, `distance_km` for sum)

---

## Safety Events & Weights

| Event              | Weight | Column in tb_device_telemetry | Trigger Value     |
|--------------------|--------|-------------------------------|-------------------|
| Overspeed          | 5      | `overspeed`                   | `'Overspeed'`     |
| Smoking            | 5      | `smoking_status`              | `'Smoking'`       |
| Mobile Usage       | 5      | `mobile_usage`                | `'Phone'`         |
| Drowsiness         | 5      | `drowsiness_status`           | `'Fatigue'`       |
| Seatbelt Violation | 5      | `seatbelt_status`             | `'Undetected'`    |
| Distraction        | 5      | `distraction_status`          | `'Distracted'`    |
| Harsh Braking      | 5      | `harsh_braking`               | `'true'`          |
| Harsh Acceleration | 5      | `harsh_acceleration`          | `'true'`          |
| Rash Turning       | 5      | `rash_turning`                | `'true'`          |

---

## Score Formula

```
Total Penalty Weight = sum of (event_count × weight) for all 9 events

Driver Safety Score (%) = 100 - ((Total Penalty Weight / Total KM Driven) × 100)

Clamped between 0% and 100%.
If KM Driven = 0 → Score = 100% (no distance, no violations possible).
```

---

## Rating Logic

| Safety Score (%) | Rating           |
|------------------|------------------|
| 95 – 100         | Excellent        |
| 90 – <95         | Very Good        |
| 85 – <90         | Good             |
| 80 – <85         | Fair             |
| 75 – <80         | Poor             |
| < 75             | Need Improvement |

---

## Important Rules

- Score is calculated per month (year + month filter on `telemetry_time` and `start_time`).
- Higher violations reduce the score; more distance with fewer violations improves it.
- Final score is always between 0% and 100%.
- Same formula used in fleet driver list, scorecard API, and mobile app.

---

## Relevant files

| File | Purpose |
|------|---------|
| `vts-backend/.../controller/FleetDriverController.java` | Score calculation + API |
| `vts-mobile/src/screens/fleet/FleetDriversScreen.tsx` | Driver list with score |
| `vts-mobile/src/screens/fleet/DriverScorecardScreen.tsx` | Detailed scorecard |
| `vts-mobile/src/services/fleetService.ts` | API types + calls |
