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
const DRAWER_W = SW * 0.62;
const HEADER_H = 156;
const CARD_H   = 48;
const CTA_W    = 80;

// ── Item definitions ──────────────────────────────────────────────────────────
const ADMIN_ITEMS = [
  { label: "Create New User or Admin",              icon: "person-add-outline",     color: "#7C3AED", bg: "#EDE9FE", nav: "CreateClient",             params: undefined },
  { label: "Add Driver",                       icon: "people-outline",         color: "#16A34A", bg: "#DCFCE7", nav: "AddDriver",               params: undefined },
  { label: "Add Vehicle",                      icon: "car-outline",            color: "#EA580C", bg: "#FFEDD5", nav: "AddVehicle",              params: undefined },
  { label: "Add Device",                       icon: "phone-portrait-outline", color: "#2563EB", bg: "#DBEAFE", nav: "DeviceManagement",        params: { openAddModal: true } },
  { label: "Vehicle - Device Association",     icon: "link-outline",           color: "#E11D48", bg: "#FFE4E6", nav: "AssociationList",         params: { openAddModal: true } },
  { label: "Vehicle - Device - Driver Assoc.", icon: "git-network-outline",    color: "#0891B2", bg: "#CFFAFE", nav: "AdminFullAssociationList", params: { openAddModal: true } },
  { label: "Register Trip",                    icon: "clipboard-outline",      color: "#7C3AED", bg: "#EDE9FE", nav: "RegisterTrip",            params: undefined },
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

// ── Simple CTA Button ───────────────────────────────────────────────────────────
const SimpleCTA = ({ color, bg }: { color: string; bg: string }) => (
  <View style={[cta.box, { backgroundColor: bg }]}>
    <Text style={[cta.txt, { color }]}>Click</Text>
    <Ionicons name="chevron-forward" size={14} color={color} />
  </View>
);

const cta = StyleSheet.create({
  box:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, marginRight: 6 },
  txt:   { fontSize: 10, fontWeight: "700" },
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
            {/* Diagonal decoration lines */}
            <View style={s.dline1} /><View style={s.dline2} /><View style={s.dline3} />

            {/* Shield + text */}
            <View style={s.headerRow}>
              <View style={s.shieldOuter}>
                <View style={s.shieldInner}>
                  <Ionicons name="shield-checkmark" size={22} color="#1565C0" />
                </View>
              </View>
              <View style={s.headerMeta}>
                <Text style={s.title}>{roleLabel}</Text>
                <Text style={s.sub}>Fleet Management System</Text>
              </View>
            </View>
            {/* Progress indicator — full width below header content */}
            <View style={s.progressRow}>
              <View style={s.progressLine} />
              <View style={s.progressDot} />
            </View>
          </LinearGradient>

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
                  <Ionicons name={item.icon as any} size={15} color={item.color} />
                </View>
                <View style={[s.accentBar, { backgroundColor: item.color }]} />
                <Text style={s.cardLabel}>{item.label}</Text>
                <SimpleCTA color={item.color} bg={item.bg} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer — pinned OUTSIDE ScrollView */}
          <View style={s.footer}>
            <View style={s.footerLeft}>
              <View style={s.avatar}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
              <View>
                <Text style={s.footerName}>{roleLabel}</Text>
                <Text style={s.footerVer}>Version 1.0.0</Text>
              </View>
            </View>
            <View style={s.divider} />
            <TouchableOpacity onPress={logout} style={s.logoutRow}>
              <Ionicons name="log-out-outline" size={18} color="#2563EB" />
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
  header:    { height: HEADER_H, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, overflow: "hidden", justifyContent: "center", gap: 14 },
  dline1:    { position: "absolute", top: 12, right: -25, width: 130, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)", transform: [{ rotate: "38deg" }] },
  dline2:    { position: "absolute", top: 34, right: -35, width: 150, height: 1.5, backgroundColor: "rgba(255,255,255,0.07)", transform: [{ rotate: "38deg" }] },
  dline3:    { position: "absolute", top: 56, right: -20, width: 110, height: 1.5, backgroundColor: "rgba(255,255,255,0.05)", transform: [{ rotate: "38deg" }] },
  headerRow: { flexDirection: "row", alignItems: "center" },
  shieldOuter:{ width: 48, height: 48, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  shieldInner:{ width: 40, height: 40, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  headerMeta:{ flex: 1, marginLeft: 12 },
  title:     { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  sub:       { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  cyan:      { width: 28, height: 2, backgroundColor: "#06B6D4", borderRadius: 2, marginTop: 6 },
  progressRow:  { flexDirection: "row", alignItems: "center" },
  progressLine: { flex: 1, height: 2, backgroundColor: "#16A34A", borderRadius: 2 },
  progressDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFD700", marginLeft: 5 },

  // Cards
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, gap: 7 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, height: CARD_H, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  iconBox:      { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  accentBar:    { width: 3, height: 20, borderRadius: 2, marginLeft: 7 },
  cardLabel:    { flex: 1, fontSize: 11, fontWeight: "700", color: "#0D1B3E", marginLeft: 7 },

  // Footer
  footer:     { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FC", paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: 8, marginBottom: 10, marginTop: 4, borderRadius: 12, borderWidth: 1, borderTopColor: "#E5E7EB", borderColor: "#E5E7EB" },
  footerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center" },
  footerName: { fontSize: 11, fontWeight: "700", color: "#0D1B3E" },
  footerVer:  { fontSize: 9, color: "#6B7280", marginTop: 1 },
  divider:    { width: 1, height: 20, backgroundColor: "#D1D5DB", marginHorizontal: 8 },
  logoutRow:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4 },
  logoutTxt:  { fontSize: 11, fontWeight: "700", color: "#2563EB" },
});

export default CreateDrawer;