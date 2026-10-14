import webpush from "web-push";
import { nativeDb } from "./native-service";
import { validSubscription } from "./web-push-policy";
export const webPushReady = () =>
  Boolean(
    process.env.WEB_PUSH_PUBLIC_KEY &&
    process.env.WEB_PUSH_PRIVATE_KEY &&
    process.env.WEB_PUSH_SUBJECT,
  );
export async function sendWebTeamPush(
  title: string,
  body: string,
  userId?: string,
  data: Record<string, string> = {},
) {
  const db = nativeDb();
  if (!db || !webPushReady()) return;
  const devices = await db
    .collection("web_devices")
    .find(userId ? { userId } : {})
    .limit(10000)
    .toArray();
  let failed = false;
  for (let i = 0; i < devices.length; i += 20) {
    const results = await Promise.allSettled(
      devices.slice(i, i + 20).map(async (device) => {
        if (!validSubscription(device.subscription)) {
          await db.collection("web_devices").deleteOne({ _id: device._id });
          return;
        }
        try {
          await webpush.sendNotification(
            device.subscription,
            JSON.stringify({ title, body, data }),
            {
              TTL: 3600,
              urgency: "normal",
              timeout: 15000,
              vapidDetails: {
                subject: process.env.WEB_PUSH_SUBJECT!,
                publicKey: process.env.WEB_PUSH_PUBLIC_KEY!,
                privateKey: process.env.WEB_PUSH_PRIVATE_KEY!,
              },
            },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await db.collection("web_devices").deleteOne({ _id: device._id });
          else throw new Error("تعذر إرسال إشعار الويب");
        }
      }),
    );
    failed ||= results.some((result) => result.status === "rejected");
  }
  if (failed) throw new Error("تعذر إرسال بعض إشعارات الويب");
}
