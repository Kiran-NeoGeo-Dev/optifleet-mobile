import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// â”€â”€â”€ Design Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const COLORS = {
  bg:           "#060B16",
  bgCard:       "#0D1526",
  bgSection:    "#0A1222",

  glass:        "rgba(255,255,255,0.05)",
  glassMid:     "rgba(255,255,255,0.09)",
  glassStrong:  "rgba(255,255,255,0.15)",
  glassBorder:  "rgba(255,255,255,0.10)",

  inputBg:      "#111B2C",
  inputBorder:  "rgba(255,255,255,0.14)",
  inputText:    "#FFFFFF",
  placeholder:  "rgba(255,255,255,0.35)",

  cardBg:       "#0F1A2C",
  cardBorder:   "rgba(255,255,255,0.08)",

  white:        "#FFFFFF",
  whiteMuted:   "rgba(255,255,255,0.65)",
  whiteFaint:   "rgba(255,255,255,0.30)",

  accent:       "#38BDF8",
  accentGlow:   "rgba(56,189,248,0.14)",
  accentDark:   "#0EA5E9",
  green:        "#34D399",
  greenGlow:    "rgba(52,211,153,0.18)",
  green33:      "rgba(52,211,153,0.20)",
  red:          "#F87171",
  redGlow:      "rgba(248,113,113,0.18)",
  red33:        "rgba(248,113,113,0.20)",
  amber:        "#FBBF24",
  amberGlow:    "rgba(251,191,36,0.18)",
  purple:       "#A78BFA",
  purpleGlow:   "rgba(167,139,250,0.18)",
  pink:         "#F472B6",
  pinkGlow:     "rgba(244,114,182,0.18)",
  teal:         "#6EE7B7",
  tealGlow:     "rgba(110,231,183,0.18)",
  orange:       "#FB923C",
  orangeGlow:   "rgba(251,146,60,0.18)",

  overlay:      "rgba(4,10,22,0.44)",
};

export const SHADOWS = {
  glow: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  btn: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const ScreenBg = ({
  children,
  overlay = "none",
}: {
  children: React.ReactNode;
  overlay?: "none" | "dark";
}) => (
  <View style={styles.bg}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
    <View style={styles.topBar} />
    <View style={styles.orb1} />
    <View style={styles.orb2} />
    {overlay === "dark" ? <View style={styles.overlay} /> : null}
    <SafeAreaView style={styles.safe}>
      {children}
    </SafeAreaView>
  </View>
);

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: COLORS.bg },
  topBar: { height: 1, backgroundColor: COLORS.accent, opacity: 0.35 },
  safe:   { flex: 1 },
  orb1:   { position: "absolute", top: -90, right: -90, width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(56,189,248,0.06)" },
  orb2:   { position: "absolute", bottom: 120, left: -70, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(167,139,250,0.05)" },
  overlay:{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: COLORS.overlay },
});
