import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
export const DEVICE_TOKEN_KEY = "cookies:notifications:device";
export const notificationProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
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
  const projectId = notificationProjectId();
  if (!projectId)
    throw new Error(
      "هذه النسخة لا تدعم استقبال التنبيهات بعد. سنحتاج إلى نسخة محدثة بعد اكتمال إعداد الإشعارات؛ موافقة الجهاز وحدها لا تفعّل الإرسال.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "إشعارات كوكيز",
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "الإشعارات غير مسموحة. يمكنك السماح بها من إعدادات الجهاز.",
    );
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    throw new Error(
      "سمحت بالإشعارات، لكن تعذر ربط الجهاز بخدمة الإرسال. تحقق من الإنترنت؛ نسخة iOS تحتاج توقيعًا يدعم الإشعارات.",
    );
  }
}
