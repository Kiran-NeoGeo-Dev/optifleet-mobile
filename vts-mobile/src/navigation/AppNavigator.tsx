import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import AdminNavigator from "./AdminNavigator";
import DriverNavigator from "./DriverNavigator";
import { useAuth } from "../hooks/useAuth";

const AppNavigator = () => {
  const { token, isAdmin, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A1F44", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#BFDBFE" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!token
        ? <AuthNavigator />
        : role?.toLowerCase() === "driver"
          ? <DriverNavigator />
          : isAdmin
            ? <AdminNavigator />
            : <MainNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
