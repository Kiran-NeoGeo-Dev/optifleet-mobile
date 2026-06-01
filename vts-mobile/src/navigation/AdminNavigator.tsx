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
import type { TripItem }      from "../screens/trips/TripManagementScreen";

export type AdminStackParamList = {
  AdminDashboard:   undefined;
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
  DeviceManagement: { openAddModal?: boolean } | undefined;
  RegisterTrip:     undefined;
  TripManagement:   undefined;
  TripList:         undefined;
  EditTrip:         { trip: TripItem };
  TripLiveTracking: { trip: TripItem };
  Notifications:    undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

// ── Bottom Tab Bar ────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: "Dashboard",     label: "Dashboard",     icon: "pulse-outline"         },
  { key: "Management",    label: "Management",    icon: "grid-outline"          },
  { key: "Create",        label: "Create",        icon: "add"                   },
  { key: "Notifications", label: "Notifications", icon: "notifications-outline" },
  { key: "Profile",       label: "Profile",       icon: "person-outline"        },
] as const;

interface BottomBarProps {
  activeTab:    string;
  onTabPress:   (key: string) => void;
}

const { width: SW } = Dimensions.get("window");

const BottomBar = ({ activeTab, onTabPress }: BottomBarProps) => (
  <View style={tb.bar}>
    {TAB_ITEMS.map(tab => {
      const isActive  = activeTab === tab.key;
      const isCreate  = tab.key === "Create";
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
    if (key === "Notifications") navigationRef.current?.navigate("Notifications");
    if (key === "Profile")       navigationRef.current?.navigate("AdminProfile");
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
            if (current === "AdminDashboard")   setActiveTab("Dashboard");
            else if (current === "Notifications") setActiveTab("Notifications");
            else if (current === "AdminProfile")  setActiveTab("Profile");
          },
        }}
      >
        <Stack.Screen name="AdminDashboard" component={AdminDashboardWrapper} />
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
        <Stack.Screen name="RegisterTrip"     component={RegisterTripScreen} />
        <Stack.Screen name="TripManagement"   component={TripManagementScreen} />
        <Stack.Screen name="TripList"         component={TripManagementScreen} />
        <Stack.Screen name="EditTrip"         component={EditTripScreen} />
        <Stack.Screen name="TripLiveTracking" component={TripLiveTrackingScreen} />
        <Stack.Screen name="Notifications"    component={NotificationsScreen} />
      </Stack.Navigator>

      <BottomBar activeTab={activeTab} onTabPress={handleTabPress} />

      {/* Drawers rendered above everything */}
      <ManagementDrawer
        visible={managementOpen}
        onClose={() => setManagementOpen(false)}
        navigation={navigationRef.current}
      />
      <CreateDrawer
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        navigation={navigationRef.current}
        isAdmin
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

export default AdminNavigator;
