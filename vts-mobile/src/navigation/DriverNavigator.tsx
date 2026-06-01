import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverMapScreen from "../screens/driver/DriverMapScreen";
import DriverProfileScreen from "../screens/driver/DriverProfileScreen";

export type DriverStackParamList = {
  DriverMap:     undefined;
  DriverProfile: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

const DriverNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverMap"     component={DriverMapScreen} />
    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
  </Stack.Navigator>
);

export default DriverNavigator;
