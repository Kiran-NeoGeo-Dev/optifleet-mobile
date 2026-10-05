# Vehicle Details Screen Telemetry Implementation

## Date: October 5, 2026

## Overview
Implemented Task 1-3 for VehicleDetailsScreen telemetry display:
1. Only show live telemetry when ThingsBoard device state is ACTIVE
2. Use signal_strength (1-5 bars) directly instead of HDOP calculation
3. Use event_time field for Last Updated timestamp

## Backend Changes

### 1. FleetController.java
**File**: `d:\OptiFleet_Mobile\vts-backend\src\main\java\com\vts\controller\FleetController.java`

#### Changes Made:
1. **Added imports**:
   - `java.time.ZoneId`
   - `java.time.format.DateTimeFormatter`

2. **Updated `/api/fleet/vehicles/{regNo}/telemetry` endpoint** (lines 161-268):
   - Added ThingsBoard state check: `isDeviceActive = "ACTIVE".equals(tbState)`
   - **TASK 1**: Only return live values when `isDeviceActive && hasVehicleDeviceLink` is true
   - When device INACTIVE or no link: return placeholder values (speed=0, engineRpm=0, ignitionStatus="OFF", tripStatus="Offline", lastUpdateTime="—", signalHealth="Offline")
   
3. **TASK 2 - Signal Strength** (lines 187-193):
   ```java
   Integer signalStrength = (Integer) telemetry.get("signal_strength");
   String signalHealth;
   if (signalStrength != null && signalStrength >= 1 && signalStrength <= 5) {
       signalHealth = signalStrength + " bar" + (signalStrength > 1 ? "s" : "");
   } else {
       signalHealth = "—";
   }
   ```
   - Uses signal_strength value directly (1-5)
   - Formats as "1 bar", "2 bars", "3 bars", etc.
   - Falls back to "—" if value invalid/missing

4. **TASK 3 - Event Time** (lines 196-220):
   ```java
   String eventTime = (String) telemetry.get("event_time");
   if (eventTime != null && !eventTime.isEmpty()) {
       // Parse format: "DD-MM-YYYYHH:mm:ss" (no space between date and time)
       String normalized = eventTime;
       if (eventTime.length() >= 16) {
           normalized = eventTime.substring(0, 10) + " " + eventTime.substring(10);
       }
       
       DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss");
       LocalDateTime localDateTime = LocalDateTime.parse(normalized, formatter);
       ZoneId zone = ZoneId.of("Asia/Kolkata");
       ZonedDateTime zonedDateTime = localDateTime.atZone(zone);
       
       result.put("lastUpdateTime", DateTimeFormatter.ofPattern("hh:mm a").format(zonedDateTime));
       result.put("lastUpdateDate", DateTimeFormatter.ofPattern("dd/MM/yyyy").format(zonedDateTime));
   }
   ```
   - Uses event_time field directly from ThingsBoard telemetry
   - Parses format: "30-09-202616:42:10" → "30-09-2026 16:42:10"
   - Converts to Asia/Kolkata timezone
   - Outputs: lastUpdateTime = "04:42 PM", lastUpdateDate = "30/09/2026"

5. **Removed unused method**:
   - Deleted `calcSignalHealth()` method (was ~70 lines)
   - This method used HDOP ranges (0.5-20+) to calculate signal health
   - No longer needed since we use signal_strength directly

### 2. ThingsBoardDirectQueryService.java
**File**: `d:\OptiFleet_Mobile\vts-backend\src\main\java\com\vts\service\ThingsBoardDirectQueryService.java`

#### Changes Made (Previous Session):
1. **Added signal_strength to telemetry keys** (line 568):
   ```java
   String keys = "lat,lng,speed,trip_status,overspeed,smoking_status,mobile_usage," +
                 "drowsiness_status,harsh_braking,harsh_acceleration,rash_turning," +
                 "engineRpm,engine_rpm,rpm,battery_percentage,battery_status," +
                 "ignition_status,device_status,hdop,gps_accuracy,event_time,signal_strength";
   ```

2. **Added signal_strength extraction** (line 694):
   ```java
   result.put("signal_strength", dataMap.get("signal_strength"));
   ```

## Frontend Requirements (No Changes Needed)

### VehicleDetailsScreen.tsx
**File**: `d:\OptiFleet_Mobile\vts-mobile\src\screens\fleet\VehicleDetailsScreen.tsx`

The frontend already handles the backend changes correctly:
- Uses `live?.tripStatus === 'Offline'` to hide/show telemetry cards
- Displays "—" placeholders when values are missing
- Shows "Offline" status when device inactive
- Signal Health card will now display "X bar(s)" or "Offline"
- Last Updated will show actual event_time timestamp not current time

## API Response Format

### When Device ACTIVE:
```json
{
  "speed": 45,
  "engineRpm": 2500,
  "ignitionStatus": "ON",
  "tripStatus": "Moving",
  "batteryPercentage": 85,
  "batteryStatus": "Normal",
  "signalHealth": "4 bars",
  "lastUpdateTime": "04:42 PM",
  "lastUpdateDate": "30/09/2026"
}
```

### When Device INACTIVE or No Link:
```json
{
  "speed": 0,
  "engineRpm": 0,
  "ignitionStatus": "OFF",
  "tripStatus": "Offline",
  "batteryPercentage": null,
  "batteryStatus": null,
  "signalHealth": "Offline",
  "lastUpdateTime": "—",
  "lastUpdateDate": "—"
}
```

## Testing Instructions

### Test Case 1: INACTIVE Device (TR01K0968)
1. Open VehicleDetailsScreen for TR01K0968 (INACTIVE in ThingsBoard)
2. **Expected**:
   - All 6 telemetry cards show placeholder values
   - Speed: 0 km/h
   - Engine RPM: 0 RPM
   - Signal Health: "Offline"
   - Ignition: "OFF"
   - Battery: N/A or "—"
   - Last Updated: "—"

### Test Case 2: ACTIVE Device with signal_strength
1. Open VehicleDetailsScreen for an ACTIVE vehicle in ThingsBoard
2. **Expected**:
   - Speed: Live value
   - Engine RPM: Live value
   - Signal Health: "1 bar", "2 bars", "3 bars", "4 bars", or "5 bars" (based on signal_strength value)
   - Ignition: "ON" or "OFF"
   - Battery: Live percentage
   - Last Updated: Shows actual event_time timestamp (e.g., "04:42 PM 30/09/2026")

### Test Case 3: ACTIVE → INACTIVE Transition
1. Start with ACTIVE vehicle showing live data
2. Simulate device going INACTIVE in ThingsBoard
3. **Expected**:
   - All cards should switch to placeholder/Offline values
   - No stale live data should persist

## Key Technical Details

1. **ThingsBoard State Check**:
   - Backend checks `thingsBoardState` field returned from telemetry
   - Only "ACTIVE" state allows live data display
   - Any other state (INACTIVE, null) returns placeholders

2. **Signal Strength Values**:
   - ThingsBoard returns signal_strength as Integer (1-5)
   - 1 = Weakest (1 bar)
   - 5 = Strongest (5 bars)
   - Invalid/missing = "—"

3. **Event Time Format**:
   - ThingsBoard format: "DD-MM-YYYYHH:mm:ss" (no space)
   - Example: "30-09-202616:42:10"
   - Backend normalizes to: "30-09-2026 16:42:10"
   - Parses with pattern: "dd-MM-yyyy HH:mm:ss"
   - Timezone: Asia/Kolkata (IST)

4. **Fallback Behavior**:
   - If event_time parsing fails: uses lastUpdateTime from telemetry
   - If signal_strength invalid: shows "—"
   - If telemetry fetch fails: returns all placeholders

## Related Files Modified (Previous Sessions)

1. **DashboardController.java**:
   - Fixed `/api/dashboard/live-vehicles` endpoint
   - Added isActive check for tripStatus="Offline"

2. **DashboardService.java**:
   - Added thingsBoardState="INACTIVE" check
   - Excludes INACTIVE vehicles from idle count

3. **FleetDriverController.java**:
   - Fixed driver active/inactive status based on vehicle status
   - Uses containsKey() to detect offline vehicles

## Verification Checklist

- [x] signal_strength added to ThingsBoard telemetry keys
- [x] signal_strength extracted to result map
- [x] FleetController checks isDeviceActive before returning live values
- [x] Signal Health uses signal_strength directly (1-5 bars)
- [x] Last Updated uses event_time field from telemetry
- [x] Event time parsed with correct format (dd-MM-yyyy HH:mm:ss)
- [x] Timezone set to Asia/Kolkata
- [x] Placeholder values returned when device INACTIVE
- [x] Unused calcSignalHealth() method removed
- [x] DateTimeFormatter and ZoneId imports added
- [ ] Backend compilation successful
- [ ] Test with TR01K0968 (INACTIVE device)
- [ ] Test with ACTIVE device
- [ ] Verify signal bars display correctly
- [ ] Verify Last Updated shows event_time not current time

## Notes

- Frontend VehicleDetailsScreen.tsx requires NO changes
- Frontend already handles "—" and "Offline" placeholders
- Frontend already checks `live?.tripStatus === 'Offline'` to show/hide cards
- All 6 telemetry cards (Battery, Speed, Engine RPM, Signal Health, Ignition, Last Updated) controlled by same ACTIVE/INACTIVE logic
