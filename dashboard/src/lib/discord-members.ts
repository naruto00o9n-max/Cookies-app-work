import crypto from "node:crypto";
import type { Document } from "mongodb";
import { DISCORD_API } from "./discord";
import { nativeDb } from "./native-service";
import type { SessionUser } from "./session";
import { discordMemberPatch, discordIsAdmin, type DiscordMemberProfile } from "./discord-profile";
export { discordMemberPatch, discordIsAdmin, publicMember, type DiscordMemberProfile } from "./discord-profile";

export class MemberAccessError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Stored access changes apply immediately, including to tokens issued before a profile sync. */
export async function validateMemberAccess(user: SessionUser): Promise<SessionUser> {
  const db = nativeDb();
  if (!db) throw new MemberAccessError("لم يتم إعداد قاعدة بيانات الفريق", 503);
  let member: Document | null;
  try { member = await db.collection("members").findOne({ _id: user.id as never }); }
  catch { throw new MemberAccessError("تعذر التحقق من عضوية الفريق الآن، أعد المحاولة", 503); }
  if (member?.blocked) throw new MemberAccessError("تم إيقاف دخولك إلى التطبيق. تواصل مع مشرف الفريق", 403);
  if (member?.guildPresent === false) throw new MemberAccessError("حسابك لم يعد عضوًا في سيرفر الفريق", 403);
  return {
    ...user,
    username: member?.username || user.username,
    globalName: member?.nickname || member?.globalName || member?.username || user.globalName || user.username,
    avatar: member?.avatar || user.avatar,
    isAdmin: typeof member?.isAdmin === "boolean" ? member.isAdmin : user.isAdmin,
  };
}

const SYNC_ID = "discord-member-sync";
const SYNC_INTERVAL = 6 * 60 * 60 * 1000;

export async function discordSyncStatus() {
  const doc = await nativeDb()?.collection("mobile_config").findOne({ _id: SYNC_ID as never });
  return {
    lastSyncAt: doc?.lastSyncAt || null,
    synced: Number(doc?.synced || 0),
    running: Boolean(doc?.leaseUntil && +new Date(doc.leaseUntil) > Date.now()),
    ...(doc?.error ? { error: String(doc.error) } : {}),
  };
}

async function fetchDiscord(path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${DISCORD_API}${path}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (response.ok) return response.json();
    if (response.status === 429) {
      const error = await response.json().catch(() => ({})) as { retry_after?: number };
      const retryMs = Math.ceil(Number(error.retry_after || 1) * 1000);
      if (retryMs <= 5000 && attempt < 2) { await new Promise(resolve => setTimeout(resolve, retryMs)); continue; }
      throw new Error("ديسكورد طلب إبطاء المزامنة. أعد المحاولة بعد قليل");
    }
    if (response.status === 401) throw new Error("توكن البوت غير صالح. حدّث DISCORD_BOT_TOKEN في Vercel");
    if (response.status === 403) throw new Error("فعّل Server Members Intent في إعدادات البوت، وتأكد أن البوت موجود في سيرفر الفريق");
    if (response.status === 404) throw new Error("تعذر العثور على سيرفر الفريق. راجع معرف السيرفر ووجود البوت فيه");
    throw new Error(`تعذر جلب الأعضاء من ديسكورد (${response.status})`);
  }
  throw new Error("تعذر الاتصال بديسكورد");
}

/** On-demand REST sync; the bot token does not require an always-running Discord process. */
export async function syncDiscordMembers(options: { force?: boolean; moderatorId?: string } = {}) {
  const db = nativeDb();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!db) throw new Error("لم يتم إعداد قاعدة بيانات الفريق");
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) throw new Error("أضف DISCORD_BOT_TOKEN إلى متغيرات Production في Vercel، ثم أعد النشر. يجب تفعيل Server Members Intent في صفحة البوت");
  const config = db.collection("mobile_config");
  const previous = await config.findOne({ _id: SYNC_ID as never });
  if (!options.force && previous?.lastSyncAt && Date.now() - +new Date(previous.lastSyncAt) < SYNC_INTERVAL) return { ok: true, skipped: true, synced: Number(previous.synced || 0) };
  const leaseToken = crypto.randomUUID();
  const now = new Date();
  let lease: Document | null;
  try {
    lease = await config.findOneAndUpdate(
      { _id: SYNC_ID as never, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
      { $set: { leaseUntil: new Date(Date.now() + 10 * 60_000), leaseToken, startedAt: now.toISOString() } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { ok: true, busy: true, synced: Number(previous?.synced || 0) };
    throw error;
  }
  if (!lease) return { ok: true, busy: true, synced: Number(previous?.synced || 0) };
  try {
    const [guild, roles] = await Promise.all([
      fetchDiscord(`/guilds/${guildId}`) as Promise<{ owner_id: string }>,
      fetchDiscord(`/guilds/${guildId}/roles`) as Promise<Array<{ id: string; permissions: string }>>,
    ]);
    const syncedAt = new Date().toISOString();
    let after: string | undefined;
    let synced = 0;
    for (;;) {
      const page = await fetchDiscord(`/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ""}`) as DiscordMemberProfile[];
      if (!Array.isArray(page)) throw new Error("استجابة أعضاء ديسكورد غير مكتملة");
      const humans = page.filter(member => member.user && !member.user.bot);
      if (humans.length) await db.collection("members").bulkWrite(humans.map(member => ({
        updateOne: {
          filter: { _id: member.user.id as never },
          update: { $set: { ...discordMemberPatch(member, guildId), isAdmin: discordIsAdmin(member, guildId, guild.owner_id, roles, (process.env.DISCORD_OWNER_IDS || "").split(",").map(id => id.trim()).filter(Boolean)), discordSyncedAt: syncedAt, last_seen: syncedAt }, $setOnInsert: { first_seen: syncedAt } },
          upsert: true,
        },
      })), { ordered: false });
      synced += humans.length;
      if (page.length < 1000) break;
      const next = page[page.length - 1]?.user.id;
      if (!next || next === after || (after && BigInt(next) <= BigInt(after))) throw new Error("تعذرت متابعة صفحات أعضاء ديسكورد");
      after = next;
    }
    // Only a complete successful scan can mark formerly synced members as having left.
    // Their identity, records, title and app-registration history are always retained.
    await db.collection("members").updateMany({ discordSyncedAt: { $exists: true, $ne: syncedAt } }, { $set: { guildPresent: false } });
    await config.updateOne({ _id: SYNC_ID as never, leaseToken }, { $set: { lastSyncAt: syncedAt, synced }, $unset: { error: "", leaseUntil: "", leaseToken: "" } });
    await db.collection("audit_log").insertOne({ action: "مزامنة أعضاء ديسكورد", moderator_id: options.moderatorId || null, details: `تم تحديث أسماء وصور ${synced} عضو من السيرفر`, timestamp: syncedAt });
    return { ok: true, synced };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذرت مزامنة أعضاء ديسكورد";
    await config.updateOne({ _id: SYNC_ID as never, leaseToken }, { $set: { error: message }, $unset: { leaseUntil: "", leaseToken: "" } });
    throw error;
  }
}
