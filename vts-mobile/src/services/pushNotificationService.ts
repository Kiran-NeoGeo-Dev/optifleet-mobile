import { Platform } from "react-native";
import Constants from "expo-constants";

// expo-notifications crashes at module load time in Expo Go SDK 53+.
// Using lazy require() inside each function prevents the module from
// being evaluated until actually needed (only in Dev Build / APK).
const isExpoGo = Constants.executionEnvironment === "storeClient";

export const setupNotificationChannel = async (): Promise<void> => {
  if (isExpoGo || Platform.OS !== "android") return;
  const N = require("expo-notifications");
  // Show notifications when app is in foreground
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
  await N.setNotificationChannelAsync("fleet-alerts", {
    name:             "Fleet Alerts",
    importance:       N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       "#1565C0",
    sound:            "default",
    enableVibrate:    true,
    showBadge:        true,
  });
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (isExpoGo) return false;
  const N = require("expo-notifications");
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await N.requestPermissionsAsync();
  return status === "granted";
};

export const sendLocalNotification = async (
  title: string,
  body:  string,
  data?: Record<string, any>
): Promise<void> => {
  if (isExpoGo) return;
  const N = require("expo-notifications");
  await N.scheduleNotificationAsync({
    content: {
      title,
      body,
      data:  data ?? {},
      sound: "default",
      ...(Platform.OS === "android" && { channelId: "fleet-alerts" }),
    },
    trigger: null,
  });
};
