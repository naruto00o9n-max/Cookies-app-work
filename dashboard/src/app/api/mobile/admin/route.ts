import { json, requireAdmin, isResponse } from "@/lib/api";
import { discordSyncStatus, publicMember, syncDiscordMembers } from "@/lib/discord-members";
import { nativeDb } from "@/lib/native-service";
import type { MemberDoc } from "@/lib/store/types";

export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdmin();
  if (isResponse(auth)) return auth;
  const db = nativeDb();
  if (!db) return json({ error: "لم يتم إعداد قاعدة بيانات الفريق" }, 503);
  try {
    const [members, discordSync, deviceCount] = await Promise.all([
      db.collection("members").find({}).toArray(),
      discordSyncStatus(),
      db.collection("mobile_devices").countDocuments(),
    ]);
    return json({
      members: members.map(member => publicMember(member as unknown as MemberDoc)).sort((a, b) => a.name.localeCompare(b.name, "ar")),
      configuration: {
        discordSyncConfigured: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID),
        cronConfigured: Boolean(process.env.CRON_SECRET),
        databaseConfigured: Boolean(process.env.MONGODB_URI),
        pushConfigured: deviceCount > 0,
        registeredDevices: deviceCount,
      },
      discordSync,
    });
  } catch { return json({ error: "تعذر تحميل لوحة الإشراف الآن" }, 503); }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (isResponse(auth)) return auth;
  const db = nativeDb();
  if (!db) return json({ error: "لم يتم إعداد قاعدة بيانات الفريق" }, 503);
  try {
    const raw = await req.text();
    if (raw.length > 16000) return json({ error: "الطلب كبير جدًا" }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "طلب غير صالح" }, 400);
    if (body.action === "syncDiscord") return json(await syncDiscordMembers({ force: true, moderatorId: auth.id }));
    if (body.action !== "member") return json({ error: "إجراء غير معروف" }, 400);
    if (typeof body.userId !== "string" || !/^\d{15,22}$/.test(body.userId)) return json({ error: "معرف العضو غير صالح" }, 400);
    const target = await db.collection("members").findOne({ _id: body.userId as never });
    if (!target) return json({ error: "لم يتم العثور على العضو" }, 404);
    const patch: Record<string, string | boolean> = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(body.title)) return json({ error: "اللقب يجب أن يكون نصًا من 60 حرفًا أو أقل" }, 400);
      patch.title = body.title.trim();
    }
    if (body.blocked !== undefined) {
      if (typeof body.blocked !== "boolean") return json({ error: "حالة العضو غير صالحة" }, 400);
      if (body.blocked && body.userId === auth.id) return json({ error: "لا يمكنك إيقاف حسابك أثناء إدارة الفريق" }, 400);
      patch.blocked = body.blocked;
    }
    if (!Object.keys(patch).length) return json({ error: "اختر تعديلًا للعضو" }, 400);
    await db.collection("members").updateOne({ _id: body.userId as never }, { $set: patch });
    await db.collection("audit_log").insertOne({
      action: "تحديث ملف عضو",
      moderator_id: auth.id,
      target_id: body.userId,
      details: `${target.nickname || target.globalName || target.username || body.userId}: ${JSON.stringify(patch)}`,
      timestamp: new Date().toISOString(),
    });
    return json({ ok: true, member: publicMember({ ...target, ...patch, _id: body.userId } as MemberDoc) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "تعذر تنفيذ الطلب" }, 400); }
}
