import { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const DRAWER_W = SW * 0.82;

const ADMIN_ITEMS = [
  { label: "Create New User", icon: "person-add-outline",       iconBg: "#EDE7F6", iconColor: "#7B2CBF", nav: "CreateClient",     params: undefined },
  { label: "Add Driver",      icon: "people-outline",           iconBg: "#E8F5E9", iconColor: "#2E7D32", nav: "AddDriver",         params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",              iconBg: "#FFF3E0", iconColor: "#F57C00", nav: "AddVehicle",        params: undefined },
  { label: "Add Device",      icon: "phone-portrait-outline",   iconBg: "#E3F2FD", iconColor: "#1565C0", nav: "DeviceManagement",  params: { openAddModal: true } },
  { label: "Add Association", icon: "git-network-outline",      iconBg: "#FCE4EC", iconColor: "#C2185B", nav: "AssociationList",   params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",        iconBg: "#E8F5E9", iconColor: "#0D9488", nav: "RegisterTrip",      params: undefined },
] as const;

const USER_ITEMS = [
  { label: "Add Driver",      icon: "people-outline",           iconBg: "#E8F5E9", iconColor: "#2E7D32", nav: "AddDriver",         params: undefined },
  { label: "Add Vehicle",     icon: "car-outline",              iconBg: "#FFF3E0", iconColor: "#F57C00", nav: "AddVehicle",        params: undefined },
  { label: "Add Association", icon: "git-network-outline",      iconBg: "#FCE4EC", iconColor: "#C2185B", nav: "AssociationList",   params: { openAddModal: true } },
  { label: "Register Trip",   icon: "clipboard-outline",        iconBg: "#E8F5E9", iconColor: "#0D9488", nav: "RegisterTrip",      params: undefined },
] as const;

interface Props {
  visible:    boolean;
  onClose:    () => void;
  navigation: any;
  isAdmin?:   boolean;
}

const CreateDrawer = ({ visible, onClose, navigation, isAdmin = true }: Props) => {
  const { logout } = useAuth();
  const slideX    = useRef(new Animated.Value(-DRAWER_W)).current;
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

      <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={s.drawerHeader}>
            <Image source={require("../../assets/images/OptiFleet.png")} style={s.logo} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.appName}>OptiFleet {isAdmin ? "Admin" : ""}</Text>
              <Text style={s.appSub}>Fleet Management System</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <View style={s.menuList}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[s.menuItem, idx < items.length - 1 && s.menuDivider]}
                onPress={() => navigate(item.nav, item.params)}
                activeOpacity={0.75}
              >
                <View style={[s.menuIconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                </View>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
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
                <Text style={s.footerName}>OptiFleet {isAdmin ? "Admin" : ""}</Text>
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
  logo:          { width: 44, height: 44, borderRadius: 12 },
  appName:       { fontSize: 15, fontWeight: "800", color: "#0D1B3E" },
  appSub:        { fontSize: 11, color: "#6B7280", marginTop: 1 },
  closeBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  menuList:      { flex: 1, paddingVertical: 8 },
  menuItem:      { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20, gap: 14 },
  menuDivider:   { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" },
  menuIconBox:   { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuLabel:     { flex: 1, fontSize: 14, fontWeight: "700", color: "#0D1B3E" },
  footer:        { flexDirection: "row", alignItems: "center", padding: 16, borderTopWidth: 1, borderTopColor: "#F0F0F0", margin: 12, backgroundColor: "#F8FAFF", borderRadius: 16 },
  footerLeft:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  footerIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  footerName:    { fontSize: 13, fontWeight: "700", color: "#0D1B3E" },
  footerVer:     { fontSize: 11, color: "#6B7280" },
  logoutBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
});

export default CreateDrawer;
