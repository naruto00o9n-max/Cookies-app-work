import * as Notifications from "expo-notifications";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  PushRegistrationError,
  pushStep,
  singleFlight,
} from "./notification-registration";
export const DEVICE_TOKEN_KEY = "cookies:notifications:device";
export const notificationProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
export const notificationBundleId = () => Application.applicationId;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export const enableNotifications = singleFlight(async (): Promise<string> => {
  const platform = Platform.OS;
  if (platform === "web")
    throw new PushRegistrationError(
      "configuration",
      "الإشعارات متاحة في تطبيق الهاتف",
    );
  const projectId = notificationProjectId();
  if (!projectId)
    throw new PushRegistrationError(
      "configuration",
      "مشروع الإشعارات غير مربوط بهذه النسخة. ثبّت أحدث إصدار.",
    );
  const expectedBundle = Constants.expoConfig?.ios?.bundleIdentifier;
  if (
    platform === "ios" &&
    Application.applicationId &&
    expectedBundle &&
    Application.applicationId !== expectedBundle
  )
    throw new PushRegistrationError(
      "configuration",
      `تغير معرّف التطبيق أثناء التوقيع إلى ${Application.applicationId}. أعد التوقيع مع الحفاظ على ${expectedBundle} ليطابق إعداد الإشعارات.`,
    );
  await pushStep(
    "permission",
    platform,
    async () => {
      if (platform === "android")
        await Notifications.setNotificationChannelAsync("default", {
          name: "إشعارات كوكيز",
          importance: Notifications.AndroidImportance.HIGH,
        });
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted)
        permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted)
        throw new PushRegistrationError(
          "permission",
          "الإشعارات غير مسموحة. يمكنك السماح بها من إعدادات الجهاز.",
        );
    },
    120000,
  );
  const devicePushToken = await pushStep("device", platform, () =>
    Notifications.getDevicePushTokenAsync(),
  );
  return (
    await pushStep("expo", platform, () =>
      Notifications.getExpoPushTokenAsync({ projectId, devicePushToken }),
    )
  ).data;
});
