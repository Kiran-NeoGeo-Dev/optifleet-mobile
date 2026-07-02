# Driver Safety Score Overview

## Goal
Explain in short and crystal clear terms how the driver safety score is used in the mobile app and how it is calculated in the backend.

## What exists in the mobile app

### 1. Fleet driver list screen
- File: `vts-mobile/src/screens/fleet/FleetDriversScreen.tsx`
- Purpose: shows the fleet driver list and each driver's current monthly safety score.
- Behavior:
  - loads driver list from `/api/fleet/drivers`
  - shows driver name, phone, vehicle registration, active status, and `safetyScore`
  - tapping a driver opens the scorecard screen

### 2. Driver scorecard screen
- File: `vts-mobile/src/screens/fleet/DriverScorecardScreen.tsx`
- Purpose: shows detailed safety score information for one driver and one month.
- Behavior:
  - requests scorecard data from `/api/fleet/drivers/{id}/scorecard?year={year}&month={month}`
  - displays:
    - raw safety score
    - remark category (Excellent, Very Good, Good, Fair, Poor, Very Poor)
    - event counts: smoking, mobile usage, overspeed, drowsiness, seatbelt, distraction
    - km driven
  - the score card also renders a color-coded tier chart and remark text

## Backend implementation

### 1. Controller file
- File: `vts-backend/src/main/java/com/vts/controller/FleetDriverController.java`
- This controller handles both:
  - `GET /api/fleet/drivers`
  - `GET /api/fleet/drivers/{id}/scorecard`

### 2. How the mobile list score is populated
- `GET /api/fleet/drivers` builds a driver list and includes `safetyScore`
- For each driver, it resolves the associated vehicle registration
- It loads the latest monthly raw score per vehicle using `fetchLatestScoresByVehicle("month")`
- The returned `safetyScore` in the mobile list is the vehicle's current month score

### 3. How the scorecard score is calculated
- `GET /api/fleet/drivers/{id}/scorecard` does this:
  1. lookup driver and their vehicle registration
  2. resolve the requested year and month
  3. fetch event counts for that vehicle from `public.vtelemetry` for that month/year
  4. fetch total kilometers driven for that vehicle from `public.trips`
  5. compute a weighted penalty score
  6. convert weight and km into a normalized `rawScore`
  7. assign a remark category based on the score value

### 4. Event weights
The backend uses fixed weights for each bad event:
- smoking = 5
- mobile usage = 5
- overspeed = 5
- drowsiness = 5
- seatbelt not fastened = 5
- distraction = 5

### 5. Score formula
- `weight` = sum of all event counts multiplied by their weight
- `rawScore` = `(weight / kmDriven) * 100`
- Special cases:
  - if `weight == 0`, score = `0.0`
  - if `kmDriven <= 0`, score = `0.0`

### 6. Remark categories
The backend maps `rawScore` to a string label:
- `0 <= rawScore <= 2` → `Excellent`
- `2 < rawScore <= 4` → `Very Good`
- `4 < rawScore <= 6` → `Good`
- `6 < rawScore <= 8` → `Fair`
- `8 < rawScore <= 10` → `Poor`
- `rawScore > 10` → `Very Poor`

## Important details
- Score is based on vehicle event data, not directly on driver behavior alone.
- The score is normalized by kilometers driven, so it is `weight per km * 100`.
- If there is no KM data for the vehicle, the score returns `0.0`.
- The driver scorecard API returns both the score and the raw event counts used to compute it.

## Relevant files
- Mobile list: `vts-mobile/src/screens/fleet/FleetDriversScreen.tsx`
- Mobile detail: `vts-mobile/src/screens/fleet/DriverScorecardScreen.tsx`
- Fleet API service: `vts-mobile/src/services/fleetService.ts`
- Backend controller: `vts-backend/src/main/java/com/vts/controller/FleetDriverController.java`

## Summary
The safety score is a simple normalized penalty value. More bad events per kilometer increase the score, and a lower score is better:
- `0-2` is Excellent
- `2-4` is Very Good
- `4-6` is Good
- `6-8` is Fair
- `8-10` is Poor
- `>10` is Very Poor

This document captures the complete flow from mobile screens to backend score calculation.
