import { repairAzoraCatalog } from "./azora-repair";
import { findWork } from "../../../mobile/src/lib/work-lookup";
import { catalogPost } from "../../../mobile/src/lib/azora-policy";
import crypto from "node:crypto";
import {
  MongoClient,
  type ClientSession,
  type Db,
  type Document,
} from "mongodb";
import type { RecordEntry } from "./store/types";
import type { SessionUser } from "./session";
import { applyCommand, type Command } from "../../../mobile/src/lib/commands";
import { emptySnapshot } from "../../../mobile/src/lib/seed";
import type { Snapshot } from "../../../mobile/src/lib/types";

export { totalOf, visibleEntries } from "../../../mobile/src/lib/domain";

let client: MongoClient | undefined;
export function nativeDb() {
  if (!process.env.MONGODB_URI) return null;
  client ||= new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  });
  return client.db(process.env.MONGODB_DB_NAME || "work_bot");
}
export function toSnapshot(
  records: Record<string, RecordEntry[]>,
  works: Snapshot["works"],
  settings: Document,
  members: Document[],
  months: Document[],
  audit: Document[],
): Snapshot {
  const defaults = emptySnapshot();
  return {
    version: 1,
    records: Object.entries(records).flatMap(([userId, entries]) =>
      entries.map((e, index) => ({
        ...e,
        month_key: e.month_key || e.timestamp?.slice(0, 7) || "unknown",
        userId,
        id: crypto
          .createHash("sha256")
          .update(
            JSON.stringify([
              userId,
              e.work_name,
              e.chapter,
              e.work_type,
              e.timestamp,
              index,
            ]),
          )
          .digest("hex"),
      })),
    ),
    works,
    specialties: settings.specialties || defaults.specialties,
    settings: {
      ...defaults.settings,
      ...settings,
      active_month: settings.active_month || defaults.settings.active_month,
    },
    members: [
      ...new Set([
        ...members.map((m) => String(m._id)),
        ...Object.keys(records),
      ]),
    ].map((id) => {
      const m = members.find((m) => String(m._id) === id);
      return {
        id,
        name:
          m?.nickname ||
          m?.globalName ||
          m?.username ||
          records[id]?.find((e) => e.username)?.username ||
          id,
        avatar: m?.avatar,
        username: m?.username,
        nickname: m?.nickname,
        globalName: m?.globalName,
        joinedAt: m?.joinedAt,
        firstLoginAt: m?.firstLoginAt,
        lastLoginAt: m?.lastLoginAt,
        appRegistered: Boolean(m?.appRegistered),
        isAdmin: Boolean(m?.isAdmin),
        blocked: Boolean(m?.blocked),
        title: m?.title,
      };
    }),
    months: [
      ...new Set([
        settings.active_month || defaults.settings.active_month,
        ...months.map((m) => String(m._id)),
        ...Object.values(records)
          .flatMap((list) =>
            list.map((e) => e.month_key || e.timestamp?.slice(0, 7)),
          )
          .filter((key) => key && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)),
      ]),
    ].map((key) => ({
      key,
      name: months.find((m) => String(m._id) === key)?.name || key,
    })),
    audit: audit.map((a) => ({
      id: String(a._id || a.timestamp),
      action: a.action,
      details: a.details || "",
      timestamp: a.timestamp,
      moderator_id: a.moderator_id || "",
    })),
  };
}
async function readMongo(db: Db, session?: ClientSession) {
  const r = await db
    .collection("records")
    .findOne({ _id: "records" as never }, { session });
  const w = await db
    .collection("records")
    .findOne({ _id: "works" as never }, { session });
  const settings = await db
    .collection("settings")
    .findOne({ _id: "settings" as never }, { session });
  const members = await db
    .collection("members")
    .find({}, { session })
    .toArray();
  const azoraCache = await db
    .collection("azora")
    .findOne({ _id: "cache" as never }, { session });
  const published = await db
    .collection("azora")
    .findOne({ _id: "chapters" as never }, { session });
  const enrichedWorks = (w?.data || []).map(
    (work: Snapshot["works"][number]) => {
      if (!work.azora?.slug) return work;
      const post = azoraCache?.works?.[work.azora.slug],
        chapters = published?.data?.[work.azora.slug];
      return {
        ...work,
        azora: {
          ...work.azora,
          cover: work.azora.cover || post?.featuredImage || post?.cover,
          description:
            work.azora.description ||
            (post?.postContent || "")
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
          latestChapter:
            work.azora.latestChapter ||
            (chapters?.numbers?.length
              ? String(Math.max(...chapters.numbers.map(Number)))
              : undefined),
          chapterCount: work.azora.chapterCount ?? chapters?.numbers?.length,
        },
      };
    },
  );
  const months = await db.collection("months").find({}, { session }).toArray();
  const audit = await db
    .collection("audit_log")
    .find({}, { session })
    .sort({ timestamp: -1 })
    .limit(1000)
    .toArray();
  return toSnapshot(
    r?.data || {},
    enrichedWorks,
    settings || {},
    members,
    months,
    audit,
  );
}
export async function nativeSnapshot() {
  const db = nativeDb();
  if (!db) throw new Error("لم يتم إعداد قاعدة بيانات الفريق");
  await repairAzoraCatalog(db);
  return readMongo(db);
}
function recordsOf(s: Snapshot) {
  const r: Record<string, RecordEntry[]> = Object.create(null);
  for (const e of s.records) {
    const { id: _id, userId, ...entry } = e;
    (r[userId] ||= []).push(entry);
  }
  return r;
}
async function writeMongo(
  db: Db,
  s: Snapshot,
  session: ClientSession,
  action: string,
) {
  const opts = { session, upsert: true };
  // A single Atlas transaction keeps records, prices, work names and months consistent.
  await db
    .collection("records")
    .updateOne(
      { _id: "records" as never },
      { $set: { data: recordsOf(s) }, $inc: { revision: 1 } },
      opts,
    );
  await db
    .collection("records")
    .updateOne(
      { _id: "works" as never },
      { $set: { data: s.works }, $inc: { revision: 1 } },
      opts,
    );
  const settings = { ...s.settings, specialties: s.specialties } as Document;
  delete settings._id;
  delete settings.revision;
  await db
    .collection("settings")
    .updateOne(
      { _id: "settings" as never },
      { $set: settings, $inc: { revision: 1 } },
      opts,
    );
  for (const m of s.months)
    await db
      .collection("months")
      .updateOne({ _id: m.key as never }, { $set: { name: m.name } }, opts);
  if (action === "deleteMonth" || action === "import")
    await db
      .collection("months")
      .deleteMany(
        { _id: { $nin: s.months.map((m) => m.key) as never } },
        { session },
      );
  // Importing financial backups must not overwrite verified Discord identity or access metadata.
  if (action === "import")
    for (const m of s.members)
      await db
        .collection("members")
        .updateOne(
          { _id: m.id as never },
          {
            $setOnInsert: {
              username: m.username || m.name,
              ...(m.avatar ? { avatar: m.avatar } : {}),
            },
          },
          opts,
        );
  const { id: _id, ...audit } = s.audit[0];
  await db.collection("audit_log").insertOne(audit, { session });
}
export async function nativeCommand(command: Command, user: SessionUser) {
  if (command.action === "editLast") command.payload.userId = user.id;
  if (
    ["register", "editLast"].includes(command.action) &&
    !command.payload.userId
  )
    command.payload.userId = user.id;
  const db = nativeDb();
  if (db) {
    await client!.connect();
    await repairAzoraCatalog(db);
    return client!.withSession(async (session) =>
      session.withTransaction(async () => {
        const receiptKey = command.id ? `${user.id}:${command.id}` : null;
        if (receiptKey) {
          const prior = await db
            .collection("mobile_command_receipts")
            .findOne({ _id: receiptKey as never }, { session });
          if (prior) return prior.result;
        }
        const s = await readMongo(db, session);
        let linkedPost: ReturnType<typeof catalogPost> = null;
        if (command.action === "azoraLink") {
          const cache = await db
            .collection("azora")
            .findOne({ _id: "cache" as never }, { session });
          const slug = String(command.payload.slug || "");
          const value = cache?.works?.[slug];
          linkedPost = value ? catalogPost(value, slug) : null;
          if (!linkedPost)
            throw new Error(
              "العمل ليس في فهرس فريق أزورا؛ حدّث القائمة ثم اختره من البحث",
            );
        }
        await verifyPublication(s, command, db, session);
        const result = applyCommand(
          s,
          command,
          {
            id: user.id,
            name: user.globalName || user.username,
            isAdmin: user.isAdmin,
          },
          true,
        );
        if (linkedPost) {
          const work = findWork(s.works, String(command.payload.work));
          if (work?.azora)
            work.azora = {
              ...work.azora,
              cover: linkedPost.featuredImage,
              title: linkedPost.postTitle,
              title_en: linkedPost.postTitle,
              ...(linkedPost.id ? { post_id: linkedPost.id } : {}),
            };
        }
        await writeMongo(db, s, session, command.action);
        if (receiptKey)
          await db
            .collection("mobile_command_receipts")
            .insertOne(
              {
                _id: receiptKey as never,
                result,
                created_at: new Date(),
                expires: new Date(Date.now() + 7 * 86400000),
              },
              { session },
            );
        if (command.action === "register") {
          const target = String(command.payload.userId),
            total = s.records
              .filter(
                (e) =>
                  e.userId === target &&
                  e.month_key === s.settings.active_month,
              )
              .reduce((a, e) => a + e.total, 0);
          if (
            s.settings.alert_threshold > 0 &&
            total >= s.settings.alert_threshold
          )
            await db
              .collection("mobile_outbox")
              .updateOne(
                {
                  _id: `threshold:${s.settings.active_month}:${target}` as never,
                },
                {
                  $setOnInsert: {
                    userId: target,
                    title: "إنجازاتك تصنع فرقًا",
                    body: `وصل إجمالي شغلك إلى ${s.settings.currency}${total.toFixed(3)}`,
                    data: { screen: "Reports" },
                    created_at: new Date(),
                    sent: false,
                  },
                },
                { session, upsert: true },
              );
        }
        if (command.action === "adjustment")
          await db
            .collection("mobile_outbox")
            .insertOne(
              {
                userId: String(command.payload.userId),
                title:
                  command.payload.kind === "مكافأة"
                    ? "مكافأة جديدة لك ✦"
                    : "تحديث على مستحقاتك",
                body: `${command.payload.kind}: ${s.settings.currency}${Number(command.payload.amount).toFixed(3)}${command.payload.notes ? " · " + String(command.payload.notes) : ""}`,
                data: { screen: "Reports" },
                created_at: new Date(),
                sent: false,
              },
              { session },
            );
        return result;
      }),
    );
  }
  throw new Error("لم يتم إعداد قاعدة بيانات الفريق");
}
export async function verifyPublication(
  s: Snapshot,
  c: Command,
  db: Db,
  session: ClientSession,
) {
  if (!["register", "editLast", "editRecord"].includes(c.action)) return;
  let month = s.settings.active_month;
  let excludeId: string | undefined;
  if (c.action === "editLast") {
    const last = s.records
      .filter(
        (e) =>
          e.userId === String(c.payload.userId) &&
          e.month_key === s.settings.active_month &&
          !["مكافأة", "خصم"].includes(e.work_type),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (!last) return;
    excludeId = last.id;
    c = {
      ...c,
      payload: {
        ...c.payload,
        work: c.payload.work || last.work_name,
        chapters: c.payload.chapter || last.chapter,
        types: c.payload.types || last.work_type,
      },
    };
  }
  if (c.action === "editRecord") {
    const entry = s.records.find((e) => e.id === String(c.payload.id));
    if (!entry || ["مكافأة", "خصم"].includes(entry.work_type)) return;
    const requestedWork = String(c.payload.work || entry.work_name),
      work = findWork(s.works, requestedWork)?.name || requestedWork,
      chapter = String(c.payload.chapter || entry.chapter).trim(),
      types = String(c.payload.types || entry.work_type).trim(),
      userId = String(c.payload.userId || entry.userId).trim();
    // Notes-only edits retain the historic price and do not require a current publication cache.
    if (
      work === entry.work_name &&
      Number(chapter) === Number(entry.chapter) &&
      types === entry.work_type &&
      userId === entry.userId
    )
      return;
    month = entry.month_key;
    excludeId = entry.id;
    c = {
      ...c,
      payload: { ...c.payload, work, chapters: chapter, types, userId },
    };
  }
  const w = findWork(s.works, String(c.payload.work));
  if (!w?.azora) return;
  const { parseChapters } = await import("../../../mobile/src/lib/domain");
  const chapters = parseChapters(String(c.payload.chapters || ""));
  const doc = await db
    .collection("azora")
    .findOne({ _id: "chapters" as never }, { session });
  const cached = doc?.data?.[w.azora.slug];
  // Match the bot: no cache is not evidence of unpublished chapters; an empty successful cache is.
  const nums = cached
    ? new Set((cached.numbers || []).map((v: unknown) => String(Number(v))))
    : null;
  const types = String(c.payload.types || "")
    .split(/[,،]/)
    .map((t) => t.trim());
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (Number(ch) < (w.paid_start ?? 0)) continue;
    if (nums && !nums.has(String(Number(ch))))
      throw new Error(`الفصل ${ch} لم ينشر على أزورا بعد`);
    const type = types.length === 1 ? types[0] : types[i];
    if (
      s.records.some(
        (e) =>
          e.id !== excludeId &&
          e.userId !== String(c.payload.userId) &&
          e.month_key === month &&
          e.work_name === w.name &&
          Number(e.chapter) === Number(ch) &&
          e.work_type === type,
      )
    )
      throw new Error(`الفصل ${ch} (${type}) مسجل لدى عضو آخر`);
  }
}
