import { useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminProfileScreen   from "../screens/admin/AdminProfileScreen";
import AdminDriverListScreen  from "../screens/admin/AdminDriverListScreen";
import AdminVehicleListScreen from "../screens/admin/AdminVehicleListScreen";
import AdminUserListScreen    from "../screens/admin/AdminUserListScreen";
import ViewUserScreen         from "../screens/admin/ViewUserScreen";
import EditUserScreen         from "../screens/admin/EditUserScreen";
import CreateClientScreen     from "../screens/admin/CreateClientScreen";
import DeviceManagementScreen from "../screens/admin/DeviceManagementScreen";
import FullMapScreen          from "../screens/admin/FullMapScreen";
import SystemOverviewScreen   from "../screens/admin/SystemOverviewScreen";
import ViewDriverPhotosScreen from "../screens/driver/ViewDriverPhotosScreen";
import AddDriverScreen        from "../screens/driver/AddDriverScreen";
import DriverPhotosScreen     from "../screens/driver/DriverPhotosScreen";
import EditDriverScreen       from "../screens/driver/EditDriverScreen";
import EditDriverPhotosScreen from "../screens/driver/EditDriverPhotosScreen";
import AddVehicleScreen       from "../screens/vehicle/AddVehicleScreen";
import EditVehicleScreen      from "../screens/vehicle/EditVehicleScreen";
import AssociationListScreen  from "../screens/dashboard/AssociationListScreen";
import RegisterTripScreen     from "../screens/dashboard/RegisterTripScreen";
import TripManagementScreen   from "../screens/trips/TripManagementScreen";
import EditTripScreen         from "../screens/trips/EditTripScreen";
import TripLiveTrackingScreen from "../screens/trips/TripLiveTrackingScreen";
import NotificationsScreen    from "../screens/admin/NotificationsScreen";
import ManagementDrawer       from "../components/ManagementDrawer";
import CreateDrawer           from "../components/CreateDrawer";
import FleetVehiclesScreen    from "../screens/fleet/FleetVehiclesScreen";
import VehicleDetailsScreen   from "../screens/fleet/VehicleDetailsScreen";
import FleetDriversScreen     from "../screens/fleet/FleetDriversScreen";
import DriverScorecardScreen  from "../screens/fleet/DriverScorecardScreen";
import type { TripItem }      from "../screens/trips/TripManagementScreen";

export type AdminStackParamList = {
  AdminDashboard:   undefined;
  SystemOverview:   undefined;
  FullMap:          undefined;
  CreateClient:     undefined;
  AdminDriverList:  undefined;
  AdminVehicleList: undefined;
  AdminUserList:    undefined;
  ViewUser:         { clientId: number };
  EditUser:         { clientId: number };
  ViewDriverPhotos: { driverId: number };
  AdminProfile:     undefined;
  AddDriver:        undefined;
  DriverPhotos: {
    driverPayload: {
      driverName: string; phoneNumber?: string; comments?: string;
      licenseNumber?: string; licenseExpiry?: string; aadharNumber?: string;
      status?: string; selectedDriverId?: number; username?: string;
      password?: string; clientId?: number;
    };
  };
  EditDriver:       { driverId: number };
  EditDriverPhotos: {
    driverId: number;
    driverPayload: {
      driverName: string; phoneNumber?: string; comments?: string;
      licenseNumber?: string; licenseExpiry?: string; aadharNumber?: string;
      status?: string; selectedDriverId?: number; username?: string; password?: string;
    };
  };
  AddVehicle:       undefined;
  EditVehicle:      { vehicleId: number };
  AssociationList:  { openAddModal?: boolean } | undefined;
  AdminFullAssociationList: { openAddModal?: boolean } | undefined;
  DeviceManagement: { openAddModal?: boolean } | undefined;
  RegisterTrip:     undefined;
  TripManagement:   undefined;
  EditTrip:         { trip: TripItem };
  TripLiveTracking: { trip: TripItem };
  Notifications:    undefined;
  FleetVehicles:    undefined;
  VehicleDetails:   { vehicle: any };
  FleetDrivers:     undefined;
  DriverScorecard:  { driver: any };
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

// ── Bottom Tab Bar ────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: "Dashboard",     label: "Dashboard",  icon: "pulse-outline"  },
  { key: "Management",    label: "Management", icon: "grid-outline"   },
  { key: "Create",        label: "Create",     icon: "add"            },
  { key: "FleetVehicles", label: "Vehicles",   icon: "bus-outline"    },
  { key: "FleetDrivers",  label: "Drivers",    icon: "people-outline" },
] as const;

interface BottomBarProps {
  activeTab:    string;
  onTabPress:   (key: string) => void;
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

// ── Main Navigator with Bottom Tabs ──────────────────────────────────────────
const AdminNavigator = () => {
  const [activeTab,        setActiveTab]        = useState("Dashboard");
  const [managementOpen,   setManagementOpen]   = useState(false);
  const [createOpen,       setCreateOpen]       = useState(false);
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
    if (key === "Dashboard")     navigationRef.current?.navigate("AdminDashboard");
    if (key === "FleetVehicles") navigationRef.current?.navigate("FleetVehicles");
    if (key === "FleetDrivers")  navigationRef.current?.navigate("FleetDrivers");
  };

  // Wrapper component to capture navigation ref
  const AdminDashboardWrapper = useCallback((props: any) => {
    navigationRef.current = props.navigation;
    return <AdminDashboardScreen {...props} />;
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
            if (current === "AdminDashboard")    setActiveTab("Dashboard");
            else if (current === "FleetVehicles" || current === "VehicleDetails")   setActiveTab("FleetVehicles");
            else if (current === "FleetDrivers"  || current === "DriverScorecard")  setActiveTab("FleetDrivers");
          },
        }}
      >
        <Stack.Screen name="AdminDashboard" component={AdminDashboardWrapper} />
        <Stack.Screen name="SystemOverview" component={SystemOverviewScreen} />
        <Stack.Screen name="CreateClient"     component={CreateClientScreen} />
        <Stack.Screen name="AdminDriverList"  component={AdminDriverListScreen} />
        <Stack.Screen name="AdminVehicleList" component={AdminVehicleListScreen} />
        <Stack.Screen name="AdminUserList"    component={AdminUserListScreen} />
        <Stack.Screen name="ViewUser"         component={ViewUserScreen} />
        <Stack.Screen name="EditUser"         component={EditUserScreen} />
        <Stack.Screen name="ViewDriverPhotos" component={ViewDriverPhotosScreen} />
        <Stack.Screen name="DeviceManagement" component={DeviceManagementScreen} />
        <Stack.Screen name="AdminProfile"     component={AdminProfileScreen} />
        <Stack.Screen name="FullMap"          component={FullMapScreen} />
        <Stack.Screen name="AddDriver"        component={AddDriverScreen} />
        <Stack.Screen name="DriverPhotos"     component={DriverPhotosScreen} />
        <Stack.Screen name="EditDriver"       component={EditDriverScreen} />
        <Stack.Screen name="EditDriverPhotos" component={EditDriverPhotosScreen} />
        <Stack.Screen name="AddVehicle"       component={AddVehicleScreen} />
        <Stack.Screen name="EditVehicle"      component={EditVehicleScreen} />
        <Stack.Screen name="AssociationList"  component={AssociationListScreen} />
        <Stack.Screen name="AdminFullAssociationList" component={AssociationListScreen} />
        <Stack.Screen name="RegisterTrip"     component={RegisterTripScreen} />
        <Stack.Screen name="TripManagement"   component={TripManagementScreen} />
        <Stack.Screen name="EditTrip"         component={EditTripScreen} />
        <Stack.Screen name="TripLiveTracking" component={TripLiveTrackingScreen} />
        <Stack.Screen name="Notifications"    component={NotificationsScreen} />
        <Stack.Screen name="FleetVehicles"   component={FleetVehiclesScreen} />
        <Stack.Screen name="VehicleDetails"  component={VehicleDetailsScreen} />
        <Stack.Screen name="FleetDrivers"    component={FleetDriversScreen} />
        <Stack.Screen name="DriverScorecard" component={DriverScorecardScreen} />
      </Stack.Navigator>

      <BottomBar activeTab={activeTab} onTabPress={handleTabPress} />

      {/* Drawers rendered above everything */}
      <ManagementDrawer
        visible={managementOpen}
        onClose={() => setManagementOpen(false)}
        navigation={navigationRef.current ?? null}
      />
      <CreateDrawer
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        navigation={navigationRef.current ?? null}
        isAdmin
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
    height: 64,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  leftSection: {
    flex: 1,
    height: 56,
    backgroundColor: "transparent",
  },
  rightSection: {
    flex: 1,
    height: 56,
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
    gap: 2,
    width: 64,
    height: 52,
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
    bottom: 4,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1565C0",
  },
  fabContainer: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -28,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1565C0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1565C0",
    shadowOpacity: 0.50,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderWidth: 4,
    borderColor: "#fff",
  },
});

export default AdminNavigator;
