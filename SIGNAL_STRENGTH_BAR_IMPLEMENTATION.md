# Signal Strength Bar Graph Implementation

## Date: October 5, 2026

## Overview
Implemented visual signal strength bar graph (similar to cellular signal indicator) to replace text-based "2 bars" / "3 bars" display. The signal bars now display 1-5 vertical bars filled based on ThingsBoard signal_strength value, along with percentage and signal quality label.

## Visual Design

### Signal Bar Display
- **5 vertical bars** with increasing heights (8px, 13px, 18px, 23px, 28px)
- **Filled bars** based on signal_strength value (1-5)
- **Percentage display** (1=20%, 2=40%, 3=60%, 4=80%, 5=100%)
- **Signal quality label** (Weak, Fair, Good, Strong, Excellent)

### Color Coding
- **5 bars (100%)**: Green (#22C55E) - "Excellent Signal"
- **4 bars (80%)**: Green (#22C55E) - "Strong Signal"
- **3 bars (60%)**: Amber (#F59E0B) - "Good Signal"
- **2 bars (40%)**: Orange (#F97316) - "Fair Signal"
- **1 bar (20%)**: Red (#EF4444) - "Weak Signal"
- **0 bars / Offline**: Gray (#D1D5DB) - "Offline"

## Backend Changes

### 1. FleetController.java
**File**: `d:\OptiFleet_Mobile\vts-backend\src\main\java\com\vts\controller\FleetController.java`

#### Updated `/api/fleet/vehicles/{regNo}/telemetry` endpoint:

**Before**:
```java
// TASK 2: Use signal_strength directly from ThingsBoard (1-5 bars)
Integer signalStrength = (Integer) telemetry.get("signal_strength");
String signalHealth;
if (signalStrength != null && signalStrength >= 1 && signalStrength <= 5) {
    signalHealth = signalStrength + " bar" + (signalStrength > 1 ? "s" : "");
} else {
    signalHealth = "—";
}
result.put("signalHealth", signalHealth);
```

**After**:
```java
// TASK 2: Return signal_strength as numeric value (1-5) for bar graph display
Integer signalStrength = (Integer) telemetry.get("signal_strength");
if (signalStrength != null && signalStrength >= 1 && signalStrength <= 5) {
    result.put("signalStrength", signalStrength);
    result.put("signalHealth", signalStrength); // Keep for backward compatibility
} else {
    result.put("signalStrength", null);
    result.put("signalHealth", "—");
}
```

**Changes**:
- Returns numeric `signalStrength` (1-5) instead of text "X bar(s)"
- Keeps `signalHealth` for backward compatibility
- When INACTIVE/Offline: `signalStrength = null`, `signalHealth = "Offline"`

## Frontend Changes

### 1. SignalStrengthBar Component (New)
**File**: `d:\OptiFleet_Mobile\vts-mobile\src\components\SignalStrengthBar.tsx`

#### Features:
- **5 vertical bars** with progressive heights
- **Fills bars** based on signal strength (1-5)
- **Shows percentage** next to bars (20%, 40%, 60%, 80%, 100%)
- **Shows quality label** below bars (Weak/Fair/Good/Strong/Excellent)
- **Handles offline state** (all bars gray, "Offline" label)
- **Color coded** based on signal quality

#### Props:
```typescript
interface SignalStrengthBarProps {
  strength: number | null | undefined;  // Signal strength (1-5) from backend
  showPercentage?: boolean;             // Show percentage text (default: true)
  showLabel?: boolean;                  // Show quality label (default: true)
}
```

#### Usage Example:
```typescript
<SignalStrengthBar 
  strength={signalStrength} 
  showPercentage={true} 
  showLabel={true} 
/>
```

### 2. VehicleDetailsScreen.tsx
**File**: `d:\OptiFleet_Mobile\vts-mobile\src\screens\fleet\VehicleDetailsScreen.tsx`

#### Changes Made:
1. **Added import**:
   ```typescript
   import SignalStrengthBar from "../../components/SignalStrengthBar";
   ```

2. **Added state**:
   ```typescript
   const [signalStrength, setSignalStrength] = useState<number | null>(null);
   ```

3. **Updated refreshTelemetry**:
   ```typescript
   setSignalStrength(data.signalStrength ?? null);
   ```

4. **Replaced InfoCell with custom Signal Health card**:
   ```typescript
   {/* Signal Health Card with Bar Graph */}
   <View style={[cell.wrap, { borderLeftColor: "#DB2777" }]}>
     <View style={[cell.iconBox, { backgroundColor: "#FCE7F3" }]}>
       <Ionicons name="cellular-outline" size={22} color="#DB2777" />
     </View>
     <Text style={cell.label}>Signal Health</Text>
     <View style={{ marginTop: 4 }}>
       <SignalStrengthBar 
         strength={signalStrength} 
         showPercentage={true} 
         showLabel={true} 
       />
     </View>
   </View>
   ```

## API Response Format

### When Device ACTIVE:
```json
{
  "speed": 45,
  "engineRpm": 2500,
  "signalStrength": 4,
  "signalHealth": 4,
  "lastUpdateTime": "04:42 PM",
  "lastUpdateDate": "30/09/2026"
}
```

### When Device INACTIVE or No Link:
```json
{
  "speed": 0,
  "engineRpm": 0,
  "signalStrength": null,
  "signalHealth": "Offline",
  "lastUpdateTime": "—",
  "lastUpdateDate": "—"
}
```

## Visual Examples

### Example 1: 5 bars (Excellent Signal - 100%)
```
█ █ █ █ █  100%
█ █ █ █ █
█ █ █ █ █
█ █ █ █
█ █ █
█ █
█

Excellent Signal
```

### Example 2: 3 bars (Good Signal - 60%)
```
░ ░ █ █ █  60%
░ ░ █ █ █
░ ░ █ █ █
░ ░ █ █
░ ░ █
░ ░
░

Good Signal
```

### Example 3: 1 bar (Weak Signal - 20%)
```
░ ░ ░ ░ █  20%
░ ░ ░ ░ █
░ ░ ░ ░ █
░ ░ ░ ░
░ ░ ░
░ ░
░

Weak Signal
```

### Example 4: Offline (0 bars)
```
░ ░ ░ ░ ░
░ ░ ░ ░ ░
░ ░ ░ ░ ░
░ ░ ░ ░
░ ░ ░
░ ░
░

Offline
```

## Testing Instructions

### Test Case 1: ACTIVE Device with signal_strength = 5
1. Open VehicleDetailsScreen for vehicle with signal_strength = 5
2. **Expected**:
   - All 5 bars filled with green color
   - "100%" displayed next to bars
   - "Excellent Signal" label in green

### Test Case 2: ACTIVE Device with signal_strength = 3
1. Open VehicleDetailsScreen for vehicle with signal_strength = 3
2. **Expected**:
   - First 3 bars filled with amber color
   - Last 2 bars gray (inactive)
   - "60%" displayed next to bars
   - "Good Signal" label in amber

### Test Case 3: ACTIVE Device with signal_strength = 1
1. Open VehicleDetailsScreen for vehicle with signal_strength = 1
2. **Expected**:
   - Only first bar filled with red color
   - Other 4 bars gray (inactive)
   - "20%" displayed next to bars
   - "Weak Signal" label in red

### Test Case 4: INACTIVE Device (TR01K0968)
1. Open VehicleDetailsScreen for INACTIVE vehicle
2. **Expected**:
   - All 5 bars gray (inactive)
   - No percentage displayed
   - "Offline" label in gray

## Files Modified

### Backend:
1. `d:\OptiFleet_Mobile\vts-backend\src\main\java\com\vts\controller\FleetController.java`
   - Changed to return numeric `signalStrength` (1-5)
   - Keep `signalHealth` for backward compatibility

### Frontend:
1. `d:\OptiFleet_Mobile\vts-mobile\src\components\SignalStrengthBar.tsx` (NEW)
   - Reusable signal bar component
   
2. `d:\OptiFleet_Mobile\vts-mobile\src\screens\fleet\VehicleDetailsScreen.tsx`
   - Import SignalStrengthBar component
   - Add signalStrength state
   - Replace InfoCell with custom Signal Health card

## Advantages

1. **Visual clarity**: Bar graph is more intuitive than text "2 bars"
2. **Color coded**: Instantly shows signal quality (green/amber/orange/red)
3. **Percentage display**: Shows exact signal strength percentage
4. **Quality label**: Descriptive text (Weak/Fair/Good/Strong/Excellent)
5. **Offline handling**: Clear "Offline" state with gray bars
6. **Reusable component**: Can be used in other screens if needed
7. **Responsive**: Adapts to signal strength changes in real-time

## Notes

- Bar heights are progressive (8px, 13px, 18px, 23px, 28px) to mimic cellular signal indicators
- Bar width is 8px with 3px gap between bars
- Total bar container height is 28px
- Component handles null/undefined gracefully (shows offline state)
- Backward compatible: backend still returns `signalHealth` for any code that relies on it
