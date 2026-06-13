import { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder,
  Dimensions, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W = SW * 0.72;

const MENU_ITEMS = [
  { label: "Total Users",                        sub: "All registered users",                    icon: "person-circle-outline",  iconBg: "#EDE7F6", iconColor: "#7B2CBF", accent: "#7B2CBF", nav: "AdminUserList"           },
  { label: "Total Drivers",                      sub: "All registered drivers",                  icon: "people-outline",          iconBg: "#E8F5E9", iconColor: "#2E7D32", accent: "#22C55E", nav: "AdminDriverList"         },
  { label: "Total Vehicles",                     sub: "All registered vehicles",                 icon: "car-outline",             iconBg: "#FFF3E0", iconColor: "#F57C00", accent: "#F59E0B", nav: "AdminVehicleList"        },
  { label: "Total Devices",                      sub: "All connected devices",                   icon: "phone-portrait-outline",  iconBg: "#E3F2FD", iconColor: "#1565C0", accent: "#3B82F6", nav: "DeviceManagement"        },
  { label: "Vehicle - Device Associations",      sub: "Vehicle & device links",                  icon: "link-outline",            iconBg: "#FCE4EC", iconColor: "#C2185B", accent: "#EC4899", nav: "AssociationList"         },
  { label: "Vehicle - Device - Driver Assocs.",  sub: "Full associations with drivers",          icon: "git-network-outline",     iconBg: "#E0F2FE", iconColor: "#0369A1", accent: "#0891B2", nav: "AdminFullAssociationList"},
] as const;

interface Props {
  visible:    boolean;
  onClose:    () => void;
  navigation: any;
}

const ManagementDrawer = ({ visible, onClose, navigation }: Props) => {
  const { username, logout } = useAuth();
  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  // Swipe-to-close gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -10 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          slideX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -DRAWER_W * 0.3) {
          onClose();
        } else {
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX,    { toValue: 0,   useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(bgOpacity, { toValue: 1,   duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,    { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,          duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const navigate = (screen: string) => {
    onClose();
    setTimeout(() => navigation.navigate(screen as any), 250);
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
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
          {/* Blue Gradient Header with Wave Lines */}
          <LinearGradient
            colors={["#0A1F44", "#0D3B8E", "#1565C0", "#3B82F6"]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.blueHeader}
          >
            {/* Wave decoration lines */}
            <View style={s.waveLine1} />
            <View style={s.waveLine2} />
            <View style={s.waveLine3} />
            <View style={s.waveLine4} />
            <View style={s.waveLine5} />
            
            {/* Glowing particles */}
            <View style={s.particle1} />
            <View style={s.particle2} />
            <View style={s.particle3} />
            <View style={s.particle4} />
            
            {/* Header Content */}
            <View style={s.headerContent}>
              <View style={s.shieldBox}>
                <Ionicons name="shield-checkmark" size={36} color="#1565C0" />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={s.adminTitle}>OptiFleet Admin</Text>
                <Text style={s.adminSub}>Fleet Management System</Text>
              </View>
            </View>

            {/* Progress Indicator */}
            <View style={s.progressContainer}>
              <View style={s.progressLine} />
              <View style={s.progressDot} />
            </View>
          </LinearGradient>

          {/* Menu Items - Scrollable */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.menuList}
            showsVerticalScrollIndicator={false}
          >
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={s.menuItem}
                onPress={() => navigate(item.nav)}
                activeOpacity={0.75}
              >
                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Text style={[s.viewTxt, { color: item.accent }]}>View {"\u003E"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.footerLeft}>
              <View style={s.footerIconBox}>
                <Ionicons name="person-outline" size={24} color="#1565C0" />
              </View>
              <View>
                <Text style={s.footerName}>OptiFleet Admin</Text>
                <Text style={s.footerVer}>Version 1.0.0</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={s.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 100 },
  drawer:        { position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#fff", borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 6, height: 0 }, elevation: 20, zIndex: 101 },
  blueHeader:    { height: 190, paddingTop: 40, paddingBottom: 20, paddingHorizontal: 32, borderBottomRightRadius: 45, overflow: "hidden" },
  waveLine1:     { position: "absolute", top: 30, right: -40, width: 180, height: 3, backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "-12deg" }] },
  waveLine2:     { position: "absolute", top: 75, right: -60, width: 220, height: 3, backgroundColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "-8deg" }] },
  waveLine3:     { position: "absolute", top: 120, right: -50, width: 160, height: 3, backgroundColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-18deg" }] },
  waveLine4:     { position: "absolute", top: 165, right: -70, width: 200, height: 3, backgroundColor: "rgba(255,255,255,0.04)", transform: [{ rotate: "-5deg" }] },
  waveLine5:     { position: "absolute", top: 205, right: -50, width: 170, height: 3, backgroundColor: "rgba(255,255,255,0.03)", transform: [{ rotate: "-10deg" }] },
  particle1:     { position: "absolute", top: 50, right: 80, width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  particle2:     { position: "absolute", top: 100, right: 120, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  particle3:     { position: "absolute", top: 150, right: 60, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.2)" },
  particle4:     { position: "absolute", top: 190, right: 90, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  headerContent: { flexDirection: "row", alignItems: "flex-start", zIndex: 1, marginTop: 10 },
  shieldBox:     { width: 72, height: 72, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  adminTitle:    { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 0.5, marginTop: 4 },
  adminSub:     { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, letterSpacing: 0.3 },
  closeBtnBlue:  { position: "absolute", top: 40, right: 20, width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  progressContainer: { flexDirection: "row", alignItems: "center", marginTop: 24, zIndex: 1 },
  progressLine:  { flex: 1, height: 4, backgroundColor: "#10B981", borderRadius: 2 },
  progressDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFD700", marginLeft: 10, shadowColor: "#FFD700", shadowOpacity: 0.6, shadowRadius: 6 },
  menuList:      { flex: 1, paddingVertical: 10, paddingHorizontal: 14, paddingBottom: 80 },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, marginVertical: 4, backgroundColor: "#fff", borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, minHeight: 60 },
  menuIconBox:   { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel:     { fontSize: 14, fontWeight: "700", color: "#0D1B3E" },
  menuSub:       { fontSize: 12, color: "#4B5563", marginTop: 2, fontWeight: "500" },
  viewTxt:       { fontSize: 14, fontWeight: "700" },
  footer:        { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, marginHorizontal: 14, marginBottom: 14, marginTop: 4, backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  footerLeft:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  footerIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  footerName:    { fontSize: 14, fontWeight: "700", color: "#0D1B3E" },
  footerVer:     { fontSize: 11, color: "#6B7280" },
  logoutBtn:     { width: 42, height: 42, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
});

export default ManagementDrawer;
