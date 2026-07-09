import { useRef, useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, PanResponder, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import UserDashboardScreen from "../screens/dashboard/UserDashboardScreen";
import ClientDetailsScreen from "../screens/dashboard/ClientDetailsScreen";
import AddDriverScreen from "../screens/driver/AddDriverScreen";
import DriverPhotosScreen from "../screens/driver/DriverPhotosScreen";
import DriverListScreen from "../screens/driver/DriverListScreen";
import EditDriverScreen from "../screens/driver/EditDriverScreen";
import EditDriverPhotosScreen from "../screens/driver/EditDriverPhotosScreen";
import ViewDriverPhotosScreen from "../screens/driver/ViewDriverPhotosScreen";
import AddVehicleScreen from "../screens/vehicle/AddVehicleScreen";
import VehicleListScreen from "../screens/vehicle/VehicleListScreen";
import EditVehicleScreen from "../screens/vehicle/EditVehicleScreen";
import AssociationListScreen from "../screens/dashboard/AssociationListScreen";
import RegisterTripScreen from "../screens/dashboard/RegisterTripScreen";
import TripManagementScreen from "../screens/trips/TripManagementScreen";
import EditTripScreen from "../screens/trips/EditTripScreen";
import TripLiveTrackingScreen from "../screens/trips/TripLiveTrackingScreen";
import NotificationsScreen from "../screens/admin/NotificationsScreen";
import ManagementDrawer from "../components/ManagementDrawer";
import CreateDrawer from "../components/CreateDrawer";
import { useAuth } from "../hooks/useAuth";
import FleetVehiclesScreen  from "../screens/fleet/FleetVehiclesScreen";
import VehicleDetailsScreen from "../screens/fleet/VehicleDetailsScreen";
import FleetDriversScreen   from "../screens/fleet/FleetDriversScreen";
import DriverScorecardScreen from "../screens/fleet/DriverScorecardScreen";
import FullMapScreen         from "../screens/admin/FullMapScreen";
import type { TripItem } from "../screens/trips/TripManagementScreen";

export type MainStackParamList = {
  Dashboard: undefined;
  ClientDetails: undefined;
  AddDriver: undefined;
  DriverPhotos: {
    driverPayload: {
      driverName: string;
      phoneNumber?: string;
      comments?: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      aadharNumber?: string;
      status?: string;
      selectedDriverId?: number;
      username?: string;
      password?: string;
      clientId?: number;
    };
  };
  DriverList: undefined;
  EditDriver: { driverId: number };
  EditDriverPhotos: {
    driverId: number;
    driverPayload: {
      driverName: string;
      phoneNumber?: string;
      comments?: string;
      licenseNumber?: string;
      licenseExpiry?: string;
      aadharNumber?: string;
      status?: string;
      selectedDriverId?: number;
      username?: string;
      password?: string;
    };
  };
  ViewDriverPhotos: { driverId: number };
  AddVehicle: undefined;
  VehicleList: undefined;
  EditVehicle: { vehicleId: number };
  AssociationList: { openAddModal?: boolean } | undefined;
  RegisterTrip:     undefined;
  TripManagement:   undefined;
  EditTrip:         { trip: TripItem };
  TripLiveTracking: { trip: TripItem };
  Notifications:    undefined;
  FleetVehicles:    undefined;
  VehicleDetails:   { vehicle: any };
  FleetDrivers:     undefined;
  DriverScorecard:  { driver: any };
  FullMap:          undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const TAB_ITEMS = [
  { key: "Dashboard",     label: "Dashboard",       icon: "pulse-outline"  },
  { key: "Management",    label: "Management",      icon: "grid-outline"   },
  { key: "Create",        label: "Create",     icon: "add"            },
  { key: "FleetVehicles", label: "Vehicles",   icon: "bus-outline"    },
  { key: "FleetDrivers",  label: "Drivers",    icon: "people-outline" },
] as const;

interface BottomBarProps {
  activeTab:  string;
  onTabPress: (key: string) => void;
}

const { width: SW } = Dimensions.get("window");

const BottomBar = ({ activeTab, onTabPress }: BottomBarProps) => (
  <View style={tb.container}>
    {/* Left section with border */}
    <View style={tb.leftSection}>
      <View style={tb.leftBar}>
        {TAB_ITEMS.slice(0, 2).map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={tb.tabItem}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={isActive ? "#1565C0" : "#9CA3AF"}
              />
              <Text style={[tb.tabLabel, isActive && tb.tabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={tb.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>

    {/* Center FAB */}
    <TouchableOpacity
      style={tb.fabContainer}
      onPress={() => onTabPress("Create")}
      activeOpacity={0.85}
    >
      <View style={tb.fab}>
        <Ionicons name="add" size={22} color="#fff" />
      </View>
    </TouchableOpacity>

    {/* Right section with border */}
    <View style={tb.rightSection}>
      <View style={tb.rightBar}>
        {TAB_ITEMS.slice(3).map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={tb.tabItem}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={isActive ? "#1565C0" : "#9CA3AF"}
              />
              <Text style={[tb.tabLabel, isActive && tb.tabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={tb.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  </View>
);

const USER_MGMT_ITEMS = [
  { label: "Total Vehicles", sub: "All registered vehicles",       icon: "car-outline",            iconBg: "#FFF3E0", iconColor: "#F57C00", accent: "#F59E0B", nav: "VehicleList"     },
  { label: "Total Drivers",  sub: "All registered drivers",        icon: "people-outline",         iconBg: "#E8F5E9", iconColor: "#2E7D32", accent: "#22C55E", nav: "DriverList"      },
  { label: "Associations",   sub: "Driver & vehicle associations", icon: "git-network-outline",    iconBg: "#FCE4EC", iconColor: "#C2185B", accent: "#EC4899", nav: "AssociationList" },
] as const;

const { width: UMD_SW } = Dimensions.get("window");
const UMD_DRAWER_W = UMD_SW * 0.65;

const UserManagementDrawer = ({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) => {
  const slideX = useRef(new Animated.Value(-UMD_DRAWER_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const { logout } = useAuth();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, g: any) => g.dx < -10 && Math.abs(g.dy) < 50,
      onPanResponderMove: (_: any, g: any) => { if (g.dx < 0) slideX.setValue(g.dx); },
      onPanResponderRelease: (_: any, g: any) => {
        if (g.dx < -UMD_DRAWER_W * 0.3) {
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
        Animated.spring(slideX,    { toValue: 0,             useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX,    { toValue: -UMD_DRAWER_W, duration: 220, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0,             duration: 200, useNativeDriver: true }),
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
      <Animated.View style={[ud.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[ud.drawer, { transform: [{ translateX: slideX }] }]} {...panResponder.panHandlers}>
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
          <LinearGradient
            colors={["#0A1F44", "#0D3B8E", "#1565C0", "#3B82F6"]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={ud.header}
          >
            <View style={{ position: "absolute", top: 28, right: -40, width: 180, height: 3, backgroundColor: "rgba(255,255,255,0.1)", transform: [{ rotate: "-12deg" }] }} />
            <View style={{ position: "absolute", top: 70, right: -60, width: 220, height: 3, backgroundColor: "rgba(255,255,255,0.07)", transform: [{ rotate: "-8deg" }] }} />
            <View style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}>
              <View style={ud.shieldBox}>
                <Ionicons name="shield-checkmark" size={26} color="#1565C0" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={ud.title}>OptiFleet User</Text>
                <Text style={ud.sub}>Fleet Management System</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}>
              <View style={{ flex: 1, height: 3, backgroundColor: "#10B981", borderRadius: 2 }} />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFD700", marginLeft: 8 }} />
            </View>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={ud.menuList} showsVerticalScrollIndicator={false}>
            {USER_MGMT_ITEMS.map((item) => (
              <TouchableOpacity key={item.label} style={ud.menuItem} onPress={() => navigate(item.nav)} activeOpacity={0.75}>
                <View style={[ud.menuIconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ud.menuLabel}>{item.label}</Text>
                  <Text style={ud.menuSub}>{item.sub}</Text>
                </View>
                <Text style={[ud.viewTxt, { color: item.accent }]}>View {"\u003E"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={ud.footer}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={ud.footerIconBox}>
                <Ionicons name="person-outline" size={16} color="#1565C0" />
              </View>
              <View>
                <Text style={ud.footerName}>OptiFleet User</Text>
                <Text style={ud.footerVer}>Version 1.0.0</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={ud.logoutBtn}>
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const ud = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 100 },
  drawer:      { position: "absolute", top: 0, left: 0, bottom: 0, width: UMD_DRAWER_W, backgroundColor: "#fff", borderTopRightRadius: 20, borderBottomRightRadius: 20, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 5, height: 0 }, elevation: 18, zIndex: 101 },
  header:      { height: 156, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16, borderBottomRightRadius: 22, overflow: "hidden", justifyContent: "center", gap: 14 },
  shieldBox:   { width: 48, height: 48, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  title:       { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  sub:         { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  menuList:    { paddingVertical: 10, paddingHorizontal: 10, paddingBottom: 16 },
  menuItem:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, marginVertical: 5, backgroundColor: "#fff", borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, minHeight: 52 },
  menuIconBox: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 10 },
  menuLabel:   { fontSize: 12, fontWeight: "700", color: "#0D1B3E" },
  menuSub:     { fontSize: 10, color: "#4B5563", marginTop: 2, fontWeight: "500" },
  viewTxt:     { fontSize: 11, fontWeight: "700" },
  footer:      { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, marginHorizontal: 10, marginBottom: 12, marginTop: 4, backgroundColor: "#F8FAFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", elevation: 1 },
  footerIconBox:{ width: 34, height: 34, borderRadius: 9, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  footerName:  { fontSize: 12, fontWeight: "700", color: "#0D1B3E" },
  footerVer:   { fontSize: 10, color: "#6B7280", marginTop: 1 },
  logoutBtn:   { width: 34, height: 34, borderRadius: 9, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
});

const MainNavigator = () => {
  const [activeTab,      setActiveTab]      = useState("Dashboard");
  const [managementOpen, setManagementOpen] = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const navigationRef = useRef<any>(null);

  const handleTabPress = (key: string) => {
    if (key === "Management") {
      setManagementOpen(true);
      return;
    }
    if (key === "Create") {
      setCreateOpen(true);
      return;
    }
    setActiveTab(key);
    if (key === "Dashboard")     navigationRef.current?.navigate("Dashboard");
    if (key === "FleetVehicles") navigationRef.current?.navigate("FleetVehicles");
    if (key === "FleetDrivers")  navigationRef.current?.navigate("FleetDrivers");
  };

  // Wrapper component to capture navigation ref
  const DashboardWrapper = useCallback((props: any) => {
    navigationRef.current = props.navigation;
    return <UserDashboardScreen {...props} />;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{
          state: (e) => {
            const routes = (e.data as any)?.state?.routes;
            if (!routes) return;
            const current = routes[routes.length - 1]?.name;
            if (current === "Dashboard")            setActiveTab("Dashboard");
            else if (current === "FleetVehicles" || current === "VehicleDetails")   setActiveTab("FleetVehicles");
            else if (current === "FleetDrivers"  || current === "DriverScorecard")  setActiveTab("FleetDrivers");
          },
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardWrapper} />
        <Stack.Screen name="ClientDetails" component={ClientDetailsScreen} />
        <Stack.Screen name="AddDriver" component={AddDriverScreen} />
        <Stack.Screen name="DriverPhotos" component={DriverPhotosScreen} />
        <Stack.Screen name="DriverList" component={DriverListScreen} />
        <Stack.Screen name="EditDriver" component={EditDriverScreen} />
        <Stack.Screen name="EditDriverPhotos" component={EditDriverPhotosScreen} />
        <Stack.Screen name="ViewDriverPhotos" component={ViewDriverPhotosScreen} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
        <Stack.Screen name="VehicleList" component={VehicleListScreen} />
        <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
        <Stack.Screen name="AssociationList" component={AssociationListScreen} />
        <Stack.Screen name="RegisterTrip" component={RegisterTripScreen} />
        <Stack.Screen name="TripManagement" component={TripManagementScreen} />
        <Stack.Screen name="EditTrip" component={EditTripScreen} />
        <Stack.Screen name="TripLiveTracking" component={TripLiveTrackingScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="FleetVehicles"  component={FleetVehiclesScreen} />
        <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} />
        <Stack.Screen name="FleetDrivers"   component={FleetDriversScreen} />
        <Stack.Screen name="DriverScorecard" component={DriverScorecardScreen} />
        <Stack.Screen name="FullMap"          component={FullMapScreen} />
      </Stack.Navigator>

      <BottomBar activeTab={activeTab} onTabPress={handleTabPress} />

      <UserManagementDrawer
        visible={managementOpen}
        onClose={() => setManagementOpen(false)}
        navigation={navigationRef.current ?? null}
      />
      <CreateDrawer
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        navigation={navigationRef.current ?? null}
        isAdmin={false}
      />
    </View>
  );
};

const tb = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  leftSection: {
    flex: 1,
    height: 48,
    backgroundColor: "transparent",
  },
  rightSection: {
    flex: 1,
    height: 48,
    backgroundColor: "transparent",
  },
  leftBar: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  rightBar: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    width: 64,
    height: 48,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#1565C0",
    fontWeight: "700",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 3,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1565C0",
  },
  fabContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1565C0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1565C0",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 3,
    borderColor: "#fff",
  },
});

export default MainNavigator;
