import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function enableNotifications(): Promise<string> {
  if (Platform.OS === "web") throw new Error("الإشعارات متاحة في تطبيق الهاتف");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "إشعارات كوكيز",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("يمكن تفعيل الإشعارات من إعدادات الجهاز");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("يتطلب تفعيل الإشعارات بناء نسخة الهاتف وربط مشروع EAS");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
