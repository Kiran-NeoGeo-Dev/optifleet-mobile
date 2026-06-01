import { useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import NotificationsScreen from "../screens/dashboard/NotificationsScreen";
import ManagementDrawer from "../components/ManagementDrawer";
import CreateDrawer from "../components/CreateDrawer";
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
  TripList:         undefined;
  EditTrip:         { trip: TripItem };
  TripLiveTracking: { trip: TripItem };
  Notifications:    undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const TAB_ITEMS = [
  { key: "Dashboard",     label: "Dashboard",     icon: "pulse-outline"         },
  { key: "Management",    label: "Management",    icon: "grid-outline"          },
  { key: "Create",        label: "Create",        icon: "add"                   },
  { key: "Notifications", label: "Notifications", icon: "notifications-outline" },
  { key: "Profile",       label: "Profile",       icon: "person-outline"        },
] as const;

interface BottomBarProps {
  activeTab:  string;
  onTabPress: (key: string) => void;
}

const BottomBar = ({ activeTab, onTabPress }: BottomBarProps) => (
  <View style={tb.bar}>
    {TAB_ITEMS.map(tab => {
      const isActive = activeTab === tab.key;
      const isCreate = tab.key === "Create";
      return (
        <TouchableOpacity
          key={tab.key}
          style={tb.item}
          onPress={() => onTabPress(tab.key)}
          activeOpacity={0.75}
        >
          {isCreate ? (
            <View style={tb.fab}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ) : (
            <>
              <Ionicons
                name={tab.icon as any}
                size={24}
                color={isActive ? "#1565C0" : "#9CA3AF"}
              />
              <Text style={[tb.label, isActive && tb.labelActive]}>{tab.label}</Text>
              {isActive && <View style={tb.indicator} />}
            </>
          )}
          {isCreate && <Text style={[tb.label, { color: "#1565C0", fontWeight: "700" }]}>Create</Text>}
        </TouchableOpacity>
      );
    })}
  </View>
);

const USER_MGMT_ITEMS = [
  { label: "Vehicles",     sub: "All registered vehicles",       icon: "car-outline",            iconBg: "#FFF3E0", iconColor: "#F57C00", accent: "#F59E0B", nav: "VehicleList"     },
  { label: "Drivers",      sub: "All registered drivers",        icon: "people-outline",         iconBg: "#E8F5E9", iconColor: "#2E7D32", accent: "#22C55E", nav: "DriverList"      },
  { label: "Associations", sub: "Driver & vehicle associations", icon: "git-network-outline",    iconBg: "#FCE4EC", iconColor: "#C2185B", accent: "#EC4899", nav: "AssociationList" },
  { label: "Trips",        sub: "All trips and routes",          icon: "navigate-outline",       iconBg: "#E3F2FD", iconColor: "#1565C0", accent: "#3B82F6", nav: "TripManagement"  },
] as const;

const UserManagementDrawer = ({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) => {
  const slideX = useRef(new (require("react-native").Animated).Value(-300)).current;
  const bgOpacity = useRef(new (require("react-native").Animated).Value(0)).current;
  const { useEffect } = require("react");
  const { Animated, Dimensions, Image } = require("react-native");
  const { SafeAreaView } = require("react-native-safe-area-context");
  const { useAuth } = require("../hooks/useAuth");
  const { logout } = useAuth();
  const SW = Dimensions.get("window").width;
  const DRAWER_W = SW * 0.82;

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
      <Animated.View style={[{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 100 }, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#fff", borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 6, height: 0 }, elevation: 20, zIndex: 101 }, { transform: [{ translateX: slideX }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
            <Image source={require("../../assets/images/OptiFleet.png")} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#0D1B3E" }}>OptiFleet</Text>
              <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Fleet Management System</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingVertical: 8 }}>
            {USER_MGMT_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[{ flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20, gap: 14 }, idx < USER_MGMT_ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" }]}
                onPress={() => navigate(item.nav)}
                activeOpacity={0.75}
              >
                <View style={[{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0D1B3E" }}>{item.label}</Text>
                  <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{item.sub}</Text>
                </View>
                <Text style={[{ fontSize: 13, fontWeight: "700" }, { color: item.accent }]}>View {">"}< /Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderTopWidth: 1, borderTopColor: "#F0F0F0", margin: 12, backgroundColor: "#F8FAFF", borderRadius: 16 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#1565C0" />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#0D1B3E" }}>OptiFleet</Text>
                <Text style={{ fontSize: 11, color: "#6B7280" }}>Version 1.0.0</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

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
    if (key === "Notifications") navigationRef.current?.navigate("Notifications");
    if (key === "Profile")       navigationRef.current?.navigate("ClientDetails");
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
            if (current === "Dashboard")      setActiveTab("Dashboard");
            else if (current === "Notifications") setActiveTab("Notifications");
            else if (current === "ClientDetails") setActiveTab("Profile");
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
        <Stack.Screen name="TripList" component={TripManagementScreen} />
        <Stack.Screen name="EditTrip" component={EditTripScreen} />
        <Stack.Screen name="TripLiveTracking" component={TripLiveTrackingScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>

      <BottomBar activeTab={activeTab} onTabPress={handleTabPress} />

      <UserManagementDrawer
        visible={managementOpen}
        onClose={() => setManagementOpen(false)}
        navigation={navigationRef.current}
      />
      <CreateDrawer
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        navigation={navigationRef.current}
        isAdmin={false}
      />
    </View>
  );
};

const tb = StyleSheet.create({
  bar:       { flexDirection: "row", backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 8, paddingTop: 10, shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  item:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 52 },
  label:     { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
  labelActive:{ color: "#1565C0", fontWeight: "700" },
  indicator: { position: "absolute", bottom: -8, width: 24, height: 3, borderRadius: 2, backgroundColor: "#1565C0" },
  fab:       { width: 52, height: 52, borderRadius: 26, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center", marginBottom: 2, shadowColor: "#1565C0", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
});

export default MainNavigator;
