import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import AdminRecoveryScreen from "../screens/auth/AdminRecoveryScreen";
import DriverOtpScreen from "../screens/auth/DriverOtpScreen";

export type AuthStackParamList = {
  Login: undefined;
  AdminRecovery: undefined;
  DriverOtp: { phoneNumber: string; driverName: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="AdminRecovery" component={AdminRecoveryScreen} />
    <Stack.Screen name="DriverOtp" component={DriverOtpScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
