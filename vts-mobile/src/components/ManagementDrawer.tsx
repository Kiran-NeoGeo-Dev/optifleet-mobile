import { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W = SW * 0.82;

const MENU_ITEMS = [
  { label: "Total Users",    sub: "All registered users",          icon: "person-circle-outline",  iconBg: "#EDE7F6", iconColor: "#7B2CBF", accent: "#7B2CBF", nav: "AdminUserList"    },
  { label: "Total Drivers",  sub: "All registered drivers",        icon: "people-outline",          iconBg: "#E8F5E9", iconColor: "#2E7D32", accent: "#22C55E", nav: "AdminDriverList"  },
  { label: "Total Vehicles", sub: "All registered vehicles",       icon: "car-outline",             iconBg: "#FFF3E0", iconColor: "#F57C00", accent: "#F59E0B", nav: "AdminVehicleList" },
  { label: "Total Devices",  sub: "All connected devices",         icon: "phone-portrait-outline",  iconBg: "#E3F2FD", iconColor: "#1565C0", accent: "#3B82F6", nav: "DeviceManagement" },
  { label: "Associations",   sub: "Driver & vehicle associations", icon: "git-network-outline",     iconBg: "#FCE4EC", iconColor: "#C2185B", accent: "#EC4899", nav: "AssociationList"  },
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
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={s.drawerHeader}>
            <View style={s.logoBox}>
              <Ionicons name="shield-checkmark" size={24} color="#1565C0" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.appName}>Management</Text>
              <Text style={s.appSub}>Fleet Management System</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <View style={s.menuList}>
            {MENU_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[s.menuItem, idx < MENU_ITEMS.length - 1 && s.menuDivider]}
                onPress={() => navigate(item.nav)}
                activeOpacity={0.75}
              >
                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Text style={[s.viewTxt, { color: item.accent }]}>View {">"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.footerLeft}>
              <View style={s.footerIconBox}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#1565C0" />
              </View>
              <View>
                <Text style={s.footerName}>Admin Panel</Text>
                <Text style={s.footerVer}>Version 1.0.0</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={s.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
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
  drawerHeader:  { flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  logoBox:       { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  appName:       { fontSize: 15, fontWeight: "800", color: "#0D1B3E" },
  appSub:        { fontSize: 11, color: "#6B7280", marginTop: 1 },
  closeBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  menuList:      { flex: 1, paddingVertical: 8 },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20, gap: 14 },
  menuDivider:   { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" },
  menuIconBox:   { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuLabel:     { fontSize: 14, fontWeight: "700", color: "#0D1B3E" },
  menuSub:       { fontSize: 11, color: "#6B7280", marginTop: 2 },
  viewTxt:       { fontSize: 13, fontWeight: "700" },
  footer:        { flexDirection: "row", alignItems: "center", padding: 16, borderTopWidth: 1, borderTopColor: "#F0F0F0", margin: 12, backgroundColor: "#F8FAFF", borderRadius: 16 },
  footerLeft:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  footerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  footerName:    { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  footerVer:     { fontSize: 11, color: "#6B7280" },
  logoutBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
});

export default ManagementDrawer;
