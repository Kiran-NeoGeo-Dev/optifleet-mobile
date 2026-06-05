import { useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import FleetVehiclesScreen  from "../screens/fleet/FleetVehiclesScreen";
import VehicleDetailsScreen from "../screens/fleet/VehicleDetailsScreen";
import FleetDriversScreen   from "../screens/fleet/FleetDriversScreen";
import DriverScorecardScreen from "../screens/fleet/DriverScorecardScreen";
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
  FleetVehicles:    undefined;
  VehicleDetails:   { vehicle: any };
  FleetDrivers:     undefined;
  DriverScorecard:  { driver: any };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

const TAB_ITEMS = [
  { key: "Dashboard",     label: "Dashboard",       icon: "pulse-outline"         },
  { key: "Management",    label: "Management",      icon: "grid-outline"          },
  { key: "FleetDrivers",  label: "Fleet Drivers",   icon: "people-outline"        },
  { key: "Create",        label: "Create",          icon: "add"                   },
  { key: "FleetVehicles", label: "Fleet Vehicles",  icon: "bus-outline"           },
  { key: "Notifications", label: "Notifications",   icon: "notifications-outline" },
  { key: "Profile",       label: "Profile",         icon: "person-outline"        },
] as const;

interface BottomBarProps {
  activeTab:  string;
  onTabPress: (key: string) => void;
}

const { width: SW } = Dimensions.get("window");

const BottomBar = ({ activeTab, onTabPress }: BottomBarProps) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={tb.scrollBar}
    contentContainerStyle={tb.scrollContent}
  >
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
  </ScrollView>
);

const USER_MGMT_ITEMS = [
  { label: "Total Vehicles", sub: "All registered vehicles",       icon: "car-outline",            iconBg: "#FFF3E0", iconColor: "#F57C00", accent: "#F59E0B", nav: "VehicleList"     },
  { label: "Total Drivers",  sub: "All registered drivers",        icon: "people-outline",         iconBg: "#E8F5E9", iconColor: "#2E7D32", accent: "#22C55E", nav: "DriverList"      },
  { label: "Associations",   sub: "Driver & vehicle associations", icon: "git-network-outline",    iconBg: "#FCE4EC", iconColor: "#C2185B", accent: "#EC4899", nav: "AssociationList" },
] as const;

const UserManagementDrawer = ({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) => {
  const slideX = useRef(new (require("react-native").Animated).Value(-300)).current;
  const bgOpacity = useRef(new (require("react-native").Animated).Value(0)).current;
  const { useEffect } = require("react");
  const { Animated, Dimensions, ScrollView: SV, PanResponder } = require("react-native");
  const { SafeAreaView } = require("react-native-safe-area-context");
  const { useAuth } = require("../hooks/useAuth");
  const { logout } = useAuth();
  const SW = Dimensions.get("window").width;
  const DRAWER_W = SW * 0.72;

  // Swipe-to-close gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: any, gestureState: any) => {
        return gestureState.dx < -10 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (_: any, gestureState: any) => {
        if (gestureState.dx < 0) {
          slideX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_: any, gestureState: any) => {
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
      <Animated.View style={[{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 100 }, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View 
        style={[{ position: "absolute", top: 0, left: 0, bottom: 0, width: DRAWER_W, backgroundColor: "#fff", borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 6, height: 0 }, elevation: 20, zIndex: 101 }, { transform: [{ translateX: slideX }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
          {/* Blue Gradient Header with Wave Lines */}
          <LinearGradient
            colors={["#0A1F44", "#0D3B8E", "#1565C0", "#3B82F6"]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ height: 230, paddingTop: 50, paddingBottom: 28, paddingHorizontal: 32, borderBottomRightRadius: 45, overflow: "hidden" }}
          >
            {/* Wave decoration lines */}
            <View style={{ position: "absolute", top: 30, right: -40, width: 180, height: 3, backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "-12deg" }] }} />
            <View style={{ position: "absolute", top: 75, right: -60, width: 220, height: 3, backgroundColor: "rgba(255,255,255,0.08)", transform: [{ rotate: "-8deg" }] }} />
            <View style={{ position: "absolute", top: 120, right: -50, width: 160, height: 3, backgroundColor: "rgba(255,255,255,0.06)", transform: [{ rotate: "-18deg" }] }} />
            <View style={{ position: "absolute", top: 165, right: -70, width: 200, height: 3, backgroundColor: "rgba(255,255,255,0.04)", transform: [{ rotate: "-5deg" }] }} />
            <View style={{ position: "absolute", top: 205, right: -50, width: 170, height: 3, backgroundColor: "rgba(255,255,255,0.03)", transform: [{ rotate: "-10deg" }] }} />
            
            {/* Glowing particles */}
            <View style={{ position: "absolute", top: 50, right: 80, width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" }} />
            <View style={{ position: "absolute", top: 100, right: 120, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <View style={{ position: "absolute", top: 150, right: 60, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View style={{ position: "absolute", top: 190, right: 90, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            
            {/* Header Content */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", zIndex: 1, marginTop: 10 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
                <Ionicons name="shield-checkmark" size={36} color="#1565C0" />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 0.5, marginTop: 4 }}>OptiFleet User</Text>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, letterSpacing: 0.3 }}>Fleet Management System</Text>
              </View>
            </View>

            {/* Progress Indicator */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, zIndex: 1 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: "#10B981", borderRadius: 2 }} />
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFD700", marginLeft: 10, shadowColor: "#FFD700", shadowOpacity: 0.6, shadowRadius: 6 }} />
            </View>
          </LinearGradient>

          {/* Menu Items */}
          <SV style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {USER_MGMT_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, marginVertical: 6, backgroundColor: "#fff", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4, minHeight: 72 }}
                onPress={() => navigate(item.nav)}
                activeOpacity={0.75}
              >
                <View style={[{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#0D1B3E" }}>{item.label}</Text>
                  <Text style={{ fontSize: 13, color: "#4B5563", marginTop: 3, fontWeight: "500" }}>{item.sub}</Text>
                </View>
                <Text style={[{ fontSize: 14, fontWeight: "700" }, { color: item.accent }]}>View {"\u003E"}</Text>
              </TouchableOpacity>
            ))}
          </SV>

          {/* Footer */}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 18, margin: 16, marginBottom: 24, backgroundColor: "#F8FAFF", borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person-outline" size={24} color="#1565C0" />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#0D1B3E" }}>OptiFleet User</Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Version 1.0.0</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
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
    if (key === "FleetVehicles") navigationRef.current?.navigate("FleetVehicles");
    if (key === "FleetDrivers")  navigationRef.current?.navigate("FleetDrivers");
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
            if (current === "Dashboard")            setActiveTab("Dashboard");
            else if (current === "FleetVehicles" || current === "VehicleDetails")   setActiveTab("FleetVehicles");
            else if (current === "FleetDrivers"  || current === "DriverScorecard")  setActiveTab("FleetDrivers");
            else if (current === "Notifications")  setActiveTab("Notifications");
            else if (current === "ClientDetails")  setActiveTab("Profile");
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
        <Stack.Screen name="FleetVehicles"  component={FleetVehiclesScreen} />
        <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} />
        <Stack.Screen name="FleetDrivers"   component={FleetDriversScreen} />
        <Stack.Screen name="DriverScorecard" component={DriverScorecardScreen} />
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
  scrollBar:     { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12, maxHeight: 72 },
  scrollContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 8, paddingTop: 10 },
  item:          { width: 72, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 52 },
  label:         { fontSize: 9, fontWeight: "600", color: "#9CA3AF", textAlign: "center" },
  labelActive:   { color: "#1565C0", fontWeight: "700" },
  indicator:     { position: "absolute", bottom: -8, width: 24, height: 3, borderRadius: 2, backgroundColor: "#1565C0" },
  fab:           { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1565C0", alignItems: "center", justifyContent: "center", marginBottom: 2, shadowColor: "#1565C0", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
});

export default MainNavigator;
