import { NavigationContainer } from "@react-navigation/native";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import AdminNavigator from "./AdminNavigator";
import DriverNavigator from "./DriverNavigator";
import { useAuth } from "../hooks/useAuth";

const AppNavigator = () => {
  const { token, isAdmin, role } = useAuth();
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
