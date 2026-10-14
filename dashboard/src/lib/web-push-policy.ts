export type WebSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};
export function validSubscription(value: unknown): value is WebSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as WebSubscription;
  if (
    typeof subscription.endpoint !== "string" ||
    subscription.endpoint.length > 2048
  )
    return false;
  try {
    const url = new URL(subscription.endpoint),
      host = url.hostname;
    const allowed =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com") ||
      host.endsWith(".notification.azure.net");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !allowed
    )
      return false;
  } catch {
    return false;
  }
  const keys = subscription.keys;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string")
    return false;
  return (
    /^[A-Za-z0-9_-]{86,88}={0,2}$/.test(keys.p256dh) &&
    /^[A-Za-z0-9_-]{22,24}={0,2}$/.test(keys.auth) &&
    Buffer.from(keys.p256dh, "base64url").length === 65 &&
    Buffer.from(keys.auth, "base64url").length === 16
  );
}
