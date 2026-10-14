import { pushStep, PushRegistrationError } from "./notification-registration";
import { request, WEB_SESSION } from "./api";
export const DEVICE_TOKEN_KEY = "cookies:notifications:web-device";
export const notificationProjectId = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window
    ? "web-push"
    : null;
export const notificationBundleId = () => null;
export const notificationPermission = async () => ({
  granted:
    typeof Notification !== "undefined" &&
    Notification.permission === "granted",
});
export async function enableNotifications(): Promise<string> {
  if (
    !window.isSecureContext ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw new PushRegistrationError(
      "configuration",
      "هذا المتصفح لا يتيح إشعارات الموقع هنا. على iPhone أو iPad أضف Cookies إلى الشاشة الرئيسية وافتحه منها، باستخدام iOS 16.4 أو أحدث.",
    );
  const appleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (
    appleMobile &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    throw new PushRegistrationError(
      "configuration",
      "على iPhone وiPad: افتح قائمة المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتح Cookies من الأيقونة الجديدة لتفعيل الإشعارات.",
    );
  // Request permission directly from the user's button press, before network awaits.
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted")
    throw new PushRegistrationError(
      "permission",
      "إشعارات الموقع غير مسموحة. يمكنك تغيير إذن الموقع من إعدادات المتصفح.",
    );
  const config = await pushStep("configuration", "web", () =>
    request<{ configured: boolean; publicKey: string | null }>(
      "/api/mobile/web-devices",
      WEB_SESSION,
    ),
  );
  if (!config.configured || !config.publicKey)
    throw new PushRegistrationError(
      "configuration",
      "خدمة إشعارات الموقع لم تُجهّز بعد. حاول لاحقًا.",
    );
  const registration = await pushStep("device", "web", async () => {
    const existing = await navigator.serviceWorker.getRegistration("/app/");
    if (!existing)
      await navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
    return navigator.serviceWorker.ready;
  });
  const subscription = await pushStep("device", "web", async () => {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;
    const key = Uint8Array.from(
      atob(config.publicKey!.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
  });
  return JSON.stringify(subscription.toJSON());
}
