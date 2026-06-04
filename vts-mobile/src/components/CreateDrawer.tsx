import { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, PanResponder, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polygon, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W = SW * 0.72;
const CARD_H   = 60;
const CTA_W    = 105;

// ── Item definitions ──────────────────────────────────────────────────────────
const ADMIN_ITEMS = [
  { label: "Create New User", icon: "person-add-outline",     color: "#7C3AED", bg: "#EDE9FE", nav: "CreateClient",    params: undefined },
  { label: "Add Driver",      icon: "people-outline",         color: "#16A34A", bg: "#DCFCE7", nav: "AddDriver",        params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",            color: "#EA580C", bg: "#FFEDD5", nav: "AddVehicle",       params: undefined },
  { label: "Add Device",      icon: "phone-portrait-outline", color: "#2563EB", bg: "#DBEAFE", nav: "DeviceManagement", params: { openAddModal: true } },
  { label: "Add Association", icon: "link-outline",           color: "#E11D48", bg: "#FFE4E6", nav: "AssociationList",  params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",      color: "#0891B2", bg: "#CFFAFE", nav: "RegisterTrip",     params: undefined },
] as const;

const USER_ITEMS = [
  { label: "Add Driver",      icon: "people-outline",      color: "#16A34A", bg: "#DCFCE7", nav: "AddDriver",       params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",         color: "#EA580C", bg: "#FFEDD5", nav: "AddVehicle",      params: undefined },
  { label: "Add Association", icon: "link-outline",        color: "#E11D48", bg: "#FFE4E6", nav: "AssociationList", params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",   color: "#0891B2", bg: "#CFFAFE", nav: "RegisterTrip",    params: undefined },
] as const;

interface Props {
  visible:    boolean;
  onClose:    () => void;
  navigation: any;
  isAdmin?:   boolean;
}

// ── SVG Diagonal Header Bottom ────────────────────────────────────────────────
// Produces a true polygon cut: left side starts higher, right side lower
// matching the screenshot's diagonal from top-right to bottom-left
const DIAG_H = 48;
const HeaderDiag = ({ bgColor }: { bgColor: string }) => (
  <Svg
    width={DRAWER_W}
    height={DIAG_H}
    style={{ display: "flex" }}
  >
    {/* Blue trapezoid fills the top part */}
    <Polygon
      points={`0,0 ${DRAWER_W},0 ${DRAWER_W},${DIAG_H * 0.35} 0,${DIAG_H}`}
      fill="#2E86E8"
    />
    {/* White polygon creates the diagonal cut into the content area */}
    <Polygon
      points={`0,${DIAG_H} ${DRAWER_W},${DIAG_H * 0.35} ${DRAWER_W},${DIAG_H}`}
      fill={bgColor}
    />
  </Svg>
);

// ── SVG Slanted CTA ───────────────────────────────────────────────────────────
// True polygon: left edge is diagonal, right edge is straight
// Shape: top-left diagonal cut, rectangle on right
const SlantedCTA = ({ color, bg }: { color: string; bg: string }) => {
  const STRIP = 6;
  // Polygon points for the tinted CTA area with diagonal left edge:
  // Start from (SLANT,0) top, (CTA_W-STRIP,0), (CTA_W-STRIP,CARD_H), (0,CARD_H)
  const SLANT = 22;
  const pts = `${SLANT},0 ${CTA_W - STRIP},0 ${CTA_W - STRIP},${CARD_H} 0,${CARD_H}`;
  return (
    <View style={{ width: CTA_W, height: CARD_H }}>
      {/* SVG tinted polygon */}
      <Svg width={CTA_W} height={CARD_H} style={StyleSheet.absoluteFill}>
        <Polygon points={pts} fill={bg} />
        {/* Solid right accent strip */}
        <Polygon
          points={`${CTA_W - STRIP},0 ${CTA_W},0 ${CTA_W},${CARD_H} ${CTA_W - STRIP},${CARD_H}`}
          fill={color}
        />
      </Svg>
      {/* Click > label — positioned after the diagonal slant */}
      <View style={[cta.label, { paddingLeft: SLANT + 4 }]}>
        <Text style={[cta.txt, { color }]}>Click</Text>
        <Ionicons name="chevron-forward" size={14} color={color} />
      </View>
    </View>
  );
};

const cta = StyleSheet.create({
  label: { ...StyleSheet.absoluteFillObject, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingRight: 10 },
  txt:   { fontSize: 14, fontWeight: "800" },
});

// ── Main Component ────────────────────────────────────────────────────────────
const CreateDrawer = ({ visible, onClose, navigation, isAdmin = true }: Props) => {
  const { logout }  = useAuth();
  const roleLabel   = isAdmin ? "OptiFleet Admin" : "OptiFleet User";
  const slideX      = useRef(new Animated.Value(-DRAWER_W)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const BG          = "#F0F2F8";

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
        Animated.timing(bgOpacity, { toValue: 0,          duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const items    = isAdmin ? ADMIN_ITEMS : USER_ITEMS;
  const navigate = (screen: string, params?: any) => {
    onClose();
    setTimeout(() => navigation.navigate(screen as any, params), 250);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[s.drawer, { transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={s.safeArea} edges={["bottom"]}>

          {/* Blue gradient header */}
          <LinearGradient
            colors={["#0B1D6E", "#1040B0", "#1565C0", "#2E86E8"]}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.header}
          >
            {/* Dot matrix */}
            <View style={s.dotGrid} pointerEvents="none">
              {[0,1,2,3,4].map(r => (
                <View key={r} style={s.dotRow}>
                  {[0,1,2,3,4,5].map(c => <View key={c} style={s.dot} />)}
                </View>
              ))}
            </View>
            {/* Diagonal decoration lines */}
            <View style={s.dline1} /><View style={s.dline2} /><View style={s.dline3} />

            {/* Shield + text */}
            <View style={s.headerRow}>
              <View style={s.shieldOuter}>
                <View style={s.shieldInner}>
                  <Ionicons name="shield-checkmark" size={32} color="#1565C0" />
                </View>
              </View>
              <View style={s.headerMeta}>
                <Text style={s.title}>{roleLabel}</Text>
                <Text style={s.sub}>Fleet Management System</Text>
                <View style={s.cyan} />
              </View>
            </View>
          </LinearGradient>

          {/* TRUE SVG diagonal cut divider */}
          <HeaderDiag bgColor={BG} />

          {/* Cards — scrollable */}
          <ScrollView
            style={s.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {items.map(item => (
              <TouchableOpacity
                key={item.label}
                style={s.card}
                onPress={() => navigate(item.nav, item.params)}
                activeOpacity={0.78}
              >
                <View style={[s.iconBox, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={[s.accentBar, { backgroundColor: item.color }]} />
                <Text style={s.cardLabel} numberOfLines={1}>{item.label}</Text>
                <SlantedCTA color={item.color} bg={item.bg} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer — pinned OUTSIDE ScrollView */}
          <View style={s.footer}>
            <View style={s.footerLeft}>
              <View style={s.avatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <View>
                <Text style={s.footerName}>{roleLabel}</Text>
                <Text style={s.footerVer}>Version 1.0.0</Text>
              </View>
            </View>
            <View style={s.divider} />
            <TouchableOpacity onPress={logout} style={s.logoutRow}>
              <Ionicons name="log-out-outline" size={22} color="#2563EB" />
              <Text style={s.logoutTxt}>Logout</Text>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100 },
  drawer:       { position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#F0F2F8", zIndex: 101, elevation: 24, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 8, height: 0 } },
  safeArea:     { flex: 1 },

  // Header
  header:    { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 24, overflow: "hidden" },
  dotGrid:   { position: "absolute", top: 12, right: 8 },
  dotRow:    { flexDirection: "row", marginBottom: 5 },
  dot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(100,180,255,0.4)", marginRight: 5 },
  dline1:    { position: "absolute", top: 16, right: -25, width: 150, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", transform: [{ rotate: "38deg" }] },
  dline2:    { position: "absolute", top: 44, right: -35, width: 170, height: 1.5, backgroundColor: "rgba(255,255,255,0.07)", transform: [{ rotate: "38deg" }] },
  dline3:    { position: "absolute", top: 72, right: -20, width: 130, height: 1.5, backgroundColor: "rgba(255,255,255,0.05)", transform: [{ rotate: "38deg" }] },
  headerRow: { flexDirection: "row", alignItems: "center" },
  shieldOuter:{ width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  shieldInner:{ width: 62, height: 62, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  headerMeta:{ flex: 1, marginLeft: 16 },
  title:     { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  sub:       { fontSize: 13, color: "rgba(255,255,255,0.80)", marginTop: 4 },
  cyan:      { width: 36, height: 3, backgroundColor: "#06B6D4", borderRadius: 2, marginTop: 10 },

  // Cards
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, gap: 16 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, height: CARD_H, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  iconBox:      { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 14 },
  accentBar:    { width: 3, height: 28, borderRadius: 2, marginLeft: 10 },
  cardLabel:    { flex: 1, fontSize: 15, fontWeight: "700", color: "#0D1B3E", marginLeft: 10 },

  // Footer
  footer:     { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FC", paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  footerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center" },
  footerName: { fontSize: 15, fontWeight: "700", color: "#0D1B3E" },
  footerVer:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  divider:    { width: 1, height: 36, backgroundColor: "#D1D5DB", marginHorizontal: 14 },
  logoutRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  logoutTxt:  { fontSize: 15, fontWeight: "700", color: "#2563EB" },
});

export default CreateDrawer;
