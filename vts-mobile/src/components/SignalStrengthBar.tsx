import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface SignalStrengthBarProps {
  strength: number | null | undefined;
  showPercentage?: boolean;
  showLabel?: boolean;
}

/**
 * Signal Strength Bar Component
 * Displays 5 vertical bars with filled bars based on signal strength (1-5)
 * Similar to cellular signal indicator
 * 
 * @param strength - Signal strength value (1-5) from ThingsBoard
 * @param showPercentage - Show percentage text next to bars (default: true)
 * @param showLabel - Show "Strong Signal" / "Weak Signal" label (default: true)
 */
const SignalStrengthBar: React.FC<SignalStrengthBarProps> = ({ 
  strength, 
  showPercentage = true,
  showLabel = true
}) => {
  // Handle null, undefined, or offline
  if (strength === null || strength === undefined || strength < 1) {
    return (
      <View style={styles.container}>
        <View style={styles.barsContainer}>
          {[1, 2, 3, 4, 5].map((bar) => (
            <View
              key={bar}
              style={[
                styles.bar,
                { height: 8 + (bar - 1) * 5 }, // Heights: 8, 13, 18, 23, 28
                styles.barInactive,
              ]}
            />
          ))}
        </View>
        {showLabel && (
          <Text style={[styles.label, styles.labelOffline]}>Offline</Text>
        )}
      </View>
    );
  }

  // Ensure strength is between 1-5
  const clampedStrength = Math.max(1, Math.min(5, strength));
  
  // Calculate percentage (1 = 20%, 2 = 40%, 3 = 60%, 4 = 80%, 5 = 100%)
  const percentage = clampedStrength * 20;
  
  // Determine signal quality and color
  let signalQuality = "";
  let signalColor = "#22C55E"; // Default green
  
  if (clampedStrength === 5) {
    signalQuality = "Excellent Signal";
    signalColor = "#22C55E"; // Green
  } else if (clampedStrength === 4) {
    signalQuality = "Strong Signal";
    signalColor = "#22C55E"; // Green
  } else if (clampedStrength === 3) {
    signalQuality = "Good Signal";
    signalColor = "#F59E0B"; // Amber
  } else if (clampedStrength === 2) {
    signalQuality = "Fair Signal";
    signalColor = "#F97316"; // Orange
  } else {
    signalQuality = "Weak Signal";
    signalColor = "#EF4444"; // Red
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Signal Bars */}
        <View style={styles.barsContainer}>
          {[1, 2, 3, 4, 5].map((bar) => (
            <View
              key={bar}
              style={[
                styles.bar,
                { height: 8 + (bar - 1) * 5 }, // Heights: 8, 13, 18, 23, 28
                bar <= clampedStrength
                  ? { backgroundColor: signalColor }
                  : styles.barInactive,
              ]}
            />
          ))}
        </View>

        {/* Percentage Text */}
        {showPercentage && (
          <Text style={[styles.percentage, { color: signalColor }]}>
            {percentage}%
          </Text>
        )}
      </View>

      {/* Signal Quality Label */}
      {showLabel && (
        <Text style={[styles.label, { color: signalColor }]}>
          {signalQuality}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 28,
  },
  bar: {
    width: 8,
    borderRadius: 2,
  },
  barInactive: {
    backgroundColor: "#D1D5DB", // Light gray for inactive bars
  },
  percentage: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  labelOffline: {
    color: "#9CA3AF",
  },
});

export default SignalStrengthBar;
