import crypto from "node:crypto";
import {
  newPublishedChapters,
  workRecipients,
  azoraMetadata,
} from "./azora-events";
import { nativeDb } from "./native-service";
import { repairAzoraCatalog } from "./azora-repair";
import {
  CATALOG_VERSION,
  catalogPost,
  catalogDecision,
  canAutoAdd,
  type CatalogPost,
} from "../../../mobile/src/lib/azora-policy";
import type { Work } from "../../../mobile/src/lib/types";
const BASE = "https://api.azorafly.com";
async function get(path: string) {
  const response = await fetch(BASE + path, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`أزورا غير متاحة (${response.status})`);
  return response.json();
}
async function teamFallback(slug: string) {
  const response = await fetch(
    `https://azorafly.com/teams/${encodeURIComponent(slug)}`,
    { signal: AbortSignal.timeout(15000), cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`صفحة الفريق غير متاحة (${response.status})`);
  const html = await response.text();
  if (html.includes("Attention Required") || html.includes("cf-error"))
    throw new Error("صفحة أزورا محجوبة حاليًا");
  const slugs = [
    ...new Set(
      [...html.matchAll(/href="\/series\/([A-Za-z0-9_-]+)"/g)].map((m) => m[1]),
    ),
  ];
  if (!slugs.length)
    throw new Error("لم تُقرأ أعمال الفريق؛ بقيت البيانات السابقة محفوظة");
  return slugs.map((slug) => ({ slug, postTitle: slug }));
}
export async function azoraState() {
  const db = nativeDb();
  if (!db) throw new Error("لم يتم إعداد قاعدة بيانات الفريق");
  await repairAzoraCatalog(db);
  const [state, cache, works, job] = await Promise.all([
    db.collection("azora").findOne({ _id: "state" as never }),
    db.collection("azora").findOne({ _id: "cache" as never }),
    db.collection("records").findOne({ _id: "works" as never }),
    db.collection("azora").findOne({ _id: "mobile-sync" as never }),
  ]);
  const posts = Object.entries(cache?.works || {})
    .map(([slug, value]) => catalogPost(value as Record<string, any>, slug))
    .filter((p): p is CatalogPost => p !== null);
  return {
    state: {
      team_slug: "cookies",
      enabled: true,
      auto_add_new_works: true,
      ...state,
      syncing:
        job?.status === "running" &&
        Number(new Date(job.expires_at)) > Date.now(),
      sync_message: job?.message,
      sync_error: job?.error,
    },
    posts,
    linked: (works?.data || []).filter((w: Work) => w.azora),
  };
}
function chaptersFrom(data: any): any[] {
  const list = data.post?.chapters || data.chapters || [];
  if (!Array.isArray(list)) throw new Error("قائمة فصول أزورا غير صالحة");
  return list
    .map((ch) => ({
      ...ch,
      number: String(
        Number(
          ch.number ??
            ch.chapterNumber ??
            ch.chapter ??
            ch.title?.match(/\d+(?:\.\d+)?/)?.[0],
        ),
      ),
    }))
    .filter((ch) => ch.number !== "NaN");
}
export async function reserveAzoraSync() {
  const db = nativeDb();
  if (!db) throw new Error("أزورا تحتاج قاعدة بيانات الفريق");
  await db
    .collection("azora")
    .updateOne(
      { _id: "mobile-sync" as never },
      { $setOnInsert: { status: "idle", expires_at: new Date(0) } },
      { upsert: true },
    );
  const job = await db
    .collection("azora")
    .findOneAndUpdate(
      {
        _id: "mobile-sync" as never,
        $or: [
          { status: { $ne: "running" } },
          { expires_at: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          status: "running",
          started_at: new Date(),
          expires_at: new Date(Date.now() + 600000),
          error: null,
          message: null,
        },
      },
      { returnDocument: "after" },
    );
  return Boolean(job);
}
export async function syncAzora(reserved = false) {
  if (!reserved && !(await reserveAzoraSync()))
    return { message: "المزامنة تعمل بالفعل في الخلفية" };
  const db = nativeDb()!;
  try {
    const result = await performSync();
    await db
      .collection("azora")
      .updateOne(
        { _id: "mobile-sync" as never },
        {
          $set: {
            status: "done",
            message: result.message,
            finished_at: new Date(),
          },
        },
      );
    return result;
  } catch (e) {
    const error =
      e instanceof Error && e.name !== "TimeoutError"
        ? e.message
        : "تعذّر الاتصال بأزورا في الوقت المحدد. بيانات الفريق محفوظة؛ حاول لاحقًا";
    await db
      .collection("azora")
      .updateOne(
        { _id: "mobile-sync" as never },
        { $set: { status: "failed", error, finished_at: new Date() } },
      );
    await db
      .collection("azora")
      .updateOne(
        { _id: "state" as never },
        { $set: { last_sync_ok: false, last_error: error } },
        { upsert: true },
      );
    throw new Error(error);
  }
}
async function performSync() {
  const db = nativeDb()!;
  await repairAzoraCatalog(db);
  const state: Record<string, any> =
    (await db.collection("azora").findOne({ _id: "state" as never })) || {};
  if (state.enabled === false) return { message: "مزامنة أزورا معطلة" };
  const slug = String(state.team_slug || "cookies");
  let teamId = state.team_id;
  try {
    if (!teamId)
      for (let page = 1; page <= 10; page++) {
        const data = await get(`/api/teams?page=${page}&perPage=50`);
        const team = (data.teams || []).find((t: any) => t.slug === slug);
        if (team) {
          teamId = team.id;
          break;
        }
        if (page >= (data.totalPages || 1)) break;
      }
  } catch {}
  let complete = true;
  const posts: CatalogPost[] = [];
  try {
    if (!teamId) throw new Error("تعذر تحديد فريق أزورا");
    for (let page = 1; page <= 100; page++) {
      const data = await get(
        `/api/teams/posts/${Number(teamId)}?page=${page}&perPage=24`,
      );
      if (!Array.isArray(data.posts))
        throw new Error("بيانات الأعمال غير صالحة");
      for (const value of data.posts) {
        const post = catalogPost(value);
        if (post && !posts.some((p) => p.slug === post.slug)) posts.push(post);
      }
      if (page >= (data.totalPages || 1)) break;
      if (page === 100) throw new Error("لم يكتمل فهرس أزورا");
    }
    if (!posts.length) throw new Error("فهرس أزورا فارغ");
  } catch {
    complete = false;
    posts.splice(0, posts.length, ...(await teamFallback(slug)));
  }
  const workDoc = await db
    .collection("records")
    .findOne({ _id: "works" as never });
  const linked: Work[] = (workDoc?.data || []).filter(
    (w: Work) => w.azora?.slug,
  );
  const previous = await db
    .collection("azora")
    .findOne({ _id: "chapters" as never });
  const freshBySlug: Record<string, string[]> = {},
    metadata: Record<string, ReturnType<typeof azoraMetadata>> = {},
    chapterCache: Record<string, any> = {};
  const errors: string[] = [];
  let cursor = 0;
  // Four fetch chains at a time; a broken external work does not erase any successful cache.
  await Promise.all(
    Array.from({ length: Math.min(4, linked.length) }, async () => {
      while (cursor < linked.length) {
        const w = linked[cursor++],
          key = w.azora!.slug;
        try {
          const result = await get(
              `/api/post?postSlug=${encodeURIComponent(key)}`,
            ),
            post = result.post,
            id = post?.id;
          if (!id) throw new Error("لم يُعثر عليه على أزورا");
          const chapters = chaptersFrom(
            await get(`/api/chapters?postId=${Number(id)}`),
          );
          freshBySlug[key] = newPublishedChapters(
            Array.isArray(previous?.data?.[key]?.numbers)
              ? previous!.data[key].numbers
              : undefined,
            chapters,
          );
          metadata[key] = azoraMetadata(post, chapters);
          chapterCache[key] = {
            numbers: chapters.map((ch) => ch.number),
            chapters,
            count: chapters.length,
            updated_at: new Date().toISOString(),
            last_fetch: new Date().toISOString(),
          };
        } catch {
          errors.push(
            `تعذر تحديث فصول «${w.name.trim()}»؛ بقيت بياناته السابقة`,
          );
        }
      }
    }),
  );
  let added = 0,
    baseline = false,
    backfill = false;
  await db.client.withSession((session) =>
    session.withTransaction(async () => {
      const opts = { session, upsert: true };
      const currentState = await db
        .collection("azora")
        .findOne({ _id: "state" as never }, { session });
      if (String(currentState?.team_slug || "cookies") !== slug)
        throw new Error("تغيّر الفريق أثناء المزامنة؛ شغّلها مجددًا");
      const latest = await db
        .collection("records")
        .findOne({ _id: "works" as never }, { session });
      const works: Work[] = latest?.data || [];
      const prior = await db
        .collection("azora")
        .findOne({ _id: "cache" as never }, { session });
      const known = prior?.works || {};
      const decision = catalogDecision(
        currentState || {},
        known,
        posts,
        complete,
      );
      baseline = decision.baseline;
      backfill = decision.backfill;
      added = 0;
      for (const post of decision.add)
        if (canAutoAdd(works, post)) {
          works.push({
            name: post.postTitle.trim(),
            active: true,
            paid_start: null,
            azora: {
              slug: post.slug,
              post_id: post.id,
              title_en: post.postTitle,
              cover: post.featuredImage,
              linked_at: new Date().toISOString(),
              linked_by: "azora-sync",
            },
          });
          added++;
        }
      for (const work of works)
        if (work.azora?.slug && metadata[work.azora.slug])
          work.azora = { ...work.azora, ...metadata[work.azora.slug] };
      if (added || Object.keys(metadata).length)
        await db
          .collection("records")
          .updateOne(
            { _id: "works" as never },
            { $set: { data: works }, $inc: { revision: 1 } },
            opts,
          );
      const records = await db
        .collection("records")
        .findOne({ _id: "records" as never }, { session });
      if (!baseline && currentState?.announcements_enabled !== false)
        for (const work of works) {
          if (!work.azora?.slug) continue;
          for (const chapter of freshBySlug[work.azora.slug] || [])
            for (const userId of workRecipients(
              records?.data || {},
              work,
              chapter,
            )) {
              const eventId = crypto
                .createHash("sha256")
                .update(
                  JSON.stringify(["azora", work.azora.slug, chapter, userId]),
                )
                .digest("hex");
              await db
                .collection("mobile_outbox")
                .updateOne(
                  { _id: eventId as never },
                  {
                    $setOnInsert: {
                      userId,
                      title: "فصل جديد بانتظارك ✦",
                      body: `نُشر الفصل ${chapter} من «${work.name.trim()}» على أزورا. يمكنك تسجيله الآن.`,
                      data: { screen: "Detail", work: work.name, chapter },
                      created_at: new Date(),
                      sent: false,
                    },
                  },
                  opts,
                );
            }
        }
      // Remember everything ever seen. Reappearing/deleted titles are not new releases.
      for (const post of posts)
        known[post.slug] = complete
          ? {
              ...known[post.slug],
              ...post,
              first_seen:
                known[post.slug]?.first_seen || new Date().toISOString(),
            }
          : { ...post, ...known[post.slug] };
      await db
        .collection("azora")
        .updateOne({ _id: "cache" as never }, { $set: { works: known } }, opts);
      if (Object.keys(chapterCache).length)
        await db
          .collection("azora")
          .updateOne(
            { _id: "chapters" as never },
            {
              $set: Object.fromEntries(
                Object.entries(chapterCache).map(([key, v]) => [
                  `data.${key}`,
                  v,
                ]),
              ),
            },
            opts,
          );
      await db
        .collection("azora")
        .updateOne(
          { _id: "state" as never },
          {
            $set: {
              team_id: teamId,
              last_sync_at: new Date().toISOString(),
              last_sync_ok: true,
              last_error: errors.join("\n") || null,
              posts_source: complete ? "api" : "ssr",
              ...(complete
                ? {
                    native_catalog_version: CATALOG_VERSION,
                    baseline_done: true,
                    listing_v2: true,
                  }
                : {}),
            },
            $inc: { auto_added_count: added },
          },
          opts,
        );
    }),
  );
  const note = !complete
    ? "القائمة جزئية؛ لم تُضف أعمال تلقائيًا"
    : baseline
      ? "حُفظت القائمة الحالية دون استيراد أعمالها"
      : backfill
        ? "حُفظت الدفعة الكبيرة دون إضافة، كما في البوت"
        : `أُضيف ${added} عمل جديد`;
  return {
    message: `تحديث ${Object.keys(chapterCache).length} عمل مرتبط. ${note}.${errors.length ? "\n" + errors.join("\n") : ""}`,
  };
}
