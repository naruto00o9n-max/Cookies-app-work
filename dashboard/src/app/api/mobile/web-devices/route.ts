import crypto from "node:crypto";
import { json, requireAuth, isResponse } from "@/lib/api";
import { nativeDb } from "@/lib/native-service";
import { validSubscription } from "@/lib/web-push-policy";
import { webPushReady } from "@/lib/web-push";
export async function GET() {
  const user = await requireAuth();
  if (isResponse(user)) return user;
  return json({
    configured: webPushReady(),
    publicKey: webPushReady() ? process.env.WEB_PUSH_PUBLIC_KEY : null,
  });
}
export async function POST(req: Request) {
  const user = await requireAuth();
  if (isResponse(user)) return user;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "اشتراك غير صالح" }, 400);
  }
  if (!validSubscription(body?.subscription))
    return json({ error: "اشتراك إشعارات غير صالح" }, 400);
  const db = nativeDb();
  if (!db) return json({ error: "خدمة الفريق غير مرتبطة" }, 503);
  const id = crypto
    .createHash("sha256")
    .update(body.subscription.endpoint)
    .digest("hex");
  if (body.remove)
    await db
      .collection("web_devices")
      .deleteOne({ _id: id as never, userId: user.id });
  else {
    if (!webPushReady())
      return json({ error: "إشعارات الموقع لم تُجهّز بعد" }, 503);
    await db
      .collection("web_devices")
      .updateOne(
        { _id: id as never },
        {
          $set: {
            userId: user.id,
            subscription: {
              endpoint: body.subscription.endpoint,
              keys: body.subscription.keys,
            },
            updated_at: new Date().toISOString(),
          },
        },
        { upsert: true },
      );
  }
  return json({ ok: true });
}
