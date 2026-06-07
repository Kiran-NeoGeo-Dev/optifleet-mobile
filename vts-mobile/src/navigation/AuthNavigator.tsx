import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/auth/LoginScreen";
import AdminRecoveryScreen from "../screens/auth/AdminRecoveryScreen";

export type AuthStackParamList = {
  Login: undefined;
  AdminRecovery: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="AdminRecovery" component={AdminRecoveryScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
