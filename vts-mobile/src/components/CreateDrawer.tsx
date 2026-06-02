import { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, PanResponder, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W  = SW * 0.72;
const CARD_H    = 72;
const CTA_W     = DRAWER_W * 0.30;  // ~30% of card width

const ADMIN_ITEMS = [
  { label: "Create New User", icon: "person-add-outline",     color: "#9333EA", nav: "CreateClient",    params: undefined },
  { label: "Add Driver",      icon: "people-outline",         color: "#10B981", nav: "AddDriver",        params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",            color: "#F97316", nav: "AddVehicle",       params: undefined },
  { label: "Add Device",      icon: "phone-portrait-outline", color: "#3B82F6", nav: "DeviceManagement", params: { openAddModal: true } },
  { label: "Add Association", icon: "git-network-outline",    color: "#EC4899", nav: "AssociationList",  params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",      color: "#06B6D4", nav: "RegisterTrip",     params: undefined },
] as const;

const USER_ITEMS = [
  { label: "Add Driver",      icon: "people-outline",         color: "#10B981", nav: "AddDriver",       params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",            color: "#F97316", nav: "AddVehicle",      params: undefined },
  { label: "Add Association", icon: "git-network-outline",    color: "#EC4899", nav: "AssociationList", params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",      color: "#06B6D4", nav: "RegisterTrip",    params: undefined },
] as const;

interface Props {
  visible:    boolean;
  onClose:    () => void;
  navigation: any;
  isAdmin?:   boolean;
}

/**
 * SlantedCTA
 *
 * The card has overflow:hidden and a fixed height (CARD_H).
 * We place a full-width tinted block at the right end of the row,
 * then lay a white skewed mask on top of its LEFT edge — creating
 * the diagonal cut effect.  A solid colour strip closes the right edge.
 *
 * Layout (inside card, right-aligned):
 *
 *   ┌──────────────────┬──────────────────────┬───┐
 *   │  white card bg   │  tinted CTA body     │▌  │
 *   │               ╱  │  "Click  >"          │▌  │ ← solid edge
 *   │             ╱    │                      │▌  │
 *   └──────────────────┴──────────────────────┴───┘
 *                  ↑
 *          white skewed mask (position:absolute)
 *          overlaps left portion of tinted body
 */
const SlantedCTA = ({ color }: { color: string }) => {
  const EDGE  = 5;
  const SKEW  = 22;   // px of diagonal overlap into the tinted body
  return (
    <View style={[s.ctaOuter, { width: CTA_W }]}>
      {/* Full-height tinted fill */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `${color}1A` }]} />

      {/* White skewed mask — same bg as card — creates diagonal left edge */}
      <View
        style={[
          s.ctaMask,
          { backgroundColor: "#fff", width: SKEW + 10, left: -(SKEW / 2) },
        ]}
      />

      {/* "Click >" label, centred in the tinted area (after the mask) */}
      <View style={[s.ctaContent, { paddingLeft: SKEW / 2 + 4 }]}>
        <Text style={[s.ctaText, { color }]}>Click</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </View>

      {/* Solid right-edge accent strip */}
      <View style={[s.ctaEdge, { backgroundColor: color, width: EDGE }]} />
    </View>
  );
};

const CreateDrawer = ({ visible, onClose, navigation, isAdmin = true }: Props) => {
  const { logout }  = useAuth();
  const slideX      = useRef(new Animated.Value(-DRAWER_W)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, g: any) => g.dx < -10 && Math.abs(g.dy) < 50,
      onPanResponderMove:          (_: any, g: any) => { if (g.dx < 0) slideX.setValue(g.dx); },
      onPanResponderRelease:       (_: any, g: any) => {
        if (g.dx < -DRAWER_W * 0.3) {
          onClose();
        } else {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,    { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,    { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,         duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const items = isAdmin ? ADMIN_ITEMS : USER_ITEMS;

  const navigate = (screen: string, params?: any) => {
    onClose();
    setTimeout(() => navigation.navigate(screen as any, params), 250);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[s.drawer, { transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>

          {/* ── Blue Gradient Header ── */}
          <LinearGradient
            colors={["#0A1F44", "#0D3B8E", "#1565C0", "#3B82F6"]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.header}
          >
            {/* Dot matrix decoration */}
            <View style={s.dotGrid}>
              {[...Array(12)].map((_, i) => (
                <View key={i} style={s.dot} />
              ))}
            </View>

            <View style={s.headerRow}>
              <View style={s.shieldBox}>
                <Ionicons name="shield-checkmark" size={34} color="#1565C0" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.adminTitle}>OptiFleet Admin</Text>
                <Text style={s.adminSub}>Fleet Management System</Text>
                <View style={s.cyanBar} />
              </View>
            </View>
          </LinearGradient>

          {/*
           * ── Issue 2: Large Diagonal Section Divider ──
           *
           * Strategy: place a View (diagonalZone) directly below the header.
           * Its top half is filled with the header's bottom blue (#3B82F6).
           * A white rectangle is rotated ~-8deg so its bottom-left corner
           * sits at the very bottom-left of the zone while its top-right
           * extends well beyond the right edge — creating the steep diagonal
           * seen in the reference (white cuts in from the left, angling down).
           *)
          <View style={s.diagZone} pointerEvents="none">
            <View style={s.diagBlue} />
            <View style={s.diagWhite} />
          </View>

          {/* ── Cards + Footer in ScrollView (no flex:1 gap) ── */}
          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={s.card}
                onPress={() => navigate(item.nav, item.params)}
                activeOpacity={0.75}
              >
                {/* Icon */}
                <View style={[s.iconBox, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon as any} size={23} color={item.color} />
                </View>
                {/* Vertical accent line */}
                <View style={[s.accentLine, { backgroundColor: item.color }]} />
                {/* Title */}
                <Text style={s.cardTitle} numberOfLines={1}>{item.label}</Text>
                {/* Slanted CTA */}
                <SlantedCTA color={item.color} />
              </TouchableOpacity>
            ))}

            {/* ── Issue 4 & 5: Footer with card-equivalent top margin ── */}
            <View style={s.footer}>
              <View style={s.footerLeft}>
                <View style={s.profileCircle}>
                  <Ionicons name="person" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={s.footerName}>OptiFleet Admin</Text>
                  <Text style={s.footerVer}>Version 1.0.0</Text>
                </View>
              </View>
              <View style={s.footerDiv} />
              <TouchableOpacity onPress={logout} style={s.logoutRow}>
                <Ionicons name="log-out-outline" size={21} color="#1565C0" />
                <Text style={s.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  // ── Shell ──
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 100 },
  drawer:   { position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#EEF0F7", borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 6, height: 0 }, elevation: 20, zIndex: 101 },

  // ── Header ──
  header:    { paddingTop: 48, paddingBottom: 30, paddingHorizontal: 22, overflow: "hidden" },
  dotGrid:   { position: "absolute", top: 22, right: 16, flexDirection: "column", gap: 9 },
  dot:       { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.22)" },
  headerRow: { flexDirection: "row", alignItems: "center" },
  shieldBox: { width: 66, height: 66, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  adminTitle:{ fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  adminSub:  { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 3 },
  cyanBar:   { width: 34, height: 3, backgroundColor: "#06B6D4", borderRadius: 2, marginTop: 9 },

  // ── Diagonal divider ──
  // Zone height controls how tall the transition region is.
  diagZone:  { height: 44, overflow: "hidden" },
  // Fills the zone with the header's bottom gradient colour
  diagBlue:  { ...StyleSheet.absoluteFillObject, backgroundColor: "#3B82F6" },
  // Large white rectangle, rotated so the left side sits at the bottom-left
  // and the right side rises — matching the reference diagonal cut.
  // bottom:-8 keeps the bottom of this rect flush with the zone bottom.
  // left:-30 / right:-30 ensures full width coverage.
  diagWhite: { position: "absolute", bottom: -12, left: -30, right: -30, height: 58, backgroundColor: "#EEF0F7", transform: [{ rotate: "-7deg" }] },

  // ── Cards ──
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, marginVertical: 5, height: CARD_H, overflow: "hidden", elevation: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  iconBox:      { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  accentLine:   { width: 3, height: 28, borderRadius: 2, marginLeft: 11 },
  cardTitle:    { flex: 1, fontSize: 14, fontWeight: "700", color: "#0D1B3E", marginLeft: 11 },

  // ── Slanted CTA ──
  ctaOuter:   { height: CARD_H, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  ctaMask:    { position: "absolute", top: 0, bottom: 0, transform: [{ skewX: "-14deg" }] },
  ctaContent: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  ctaText:    { fontSize: 13, fontWeight: "700" },
  ctaEdge:    { position: "absolute", right: 0, top: 0, bottom: 0 },

  // ── Footer ──
  footer:       { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, marginTop: 5, paddingVertical: 13, paddingHorizontal: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, borderWidth: 1, borderColor: "#E8EAF0" },
  footerLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  profileCircle:{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center" },
  footerName:   { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  footerVer:    { fontSize: 11, color: "#6B7280", marginTop: 2 },
  footerDiv:    { width: 1, height: 32, backgroundColor: "#E5E7EB", marginHorizontal: 12 },
  logoutRow:    { flexDirection: "row", alignItems: "center", gap: 5 },
  logoutText:   { fontSize: 13, fontWeight: "700", color: "#1565C0" },
});

export default CreateDrawer;
