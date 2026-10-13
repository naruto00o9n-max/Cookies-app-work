import { getStore } from "@/lib/store";
import { getActiveMonth, resolvePrice } from "@/lib/agg";
import { monthKeyOf as mkOf } from "@/lib/store/types";
import { json, requireAuth, isResponse } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const work = searchParams.get("work");
    const month = searchParams.get("month");
    const type = searchParams.get("type");
    const store = getStore();
    const [records, members] = await Promise.all([store.getRecords(), store.getMembers()]);
    const out: Array<{
      userId: string;
      memberName: string;
      entry: Record<string, unknown>;
    }> = [];
    for (const [uid, entries] of Object.entries(records)) {
      if (userId && uid !== userId) continue;
      for (const e of entries) {
        if (work && e.work_name !== work) continue;
        if (month && mkOf(e) !== month) continue;
        if (type && e.work_type !== type) continue;
        const doc = members[uid];
        out.push({
          userId: uid,
          memberName: doc?.nickname || doc?.globalName || doc?.username || e.username || uid,
          entry: e as unknown as Record<string, unknown>,
        });
      }
    }
    out.sort((a, b) => String((b.entry as { timestamp?: string }).timestamp || "").localeCompare(String((a.entry as { timestamp?: string }).timestamp || "")));
    return json({ records: out.slice(0, 600) });
  } catch (e) {
    console.error("[RECORDS/GET]", e);
    return json({ error: "تعذر قراءة السجلات" }, 503);
  }
}

/**
 * تسجيل سجلات جديدة — نفس منطق البوت بالضبط:
 * فحص تكرار (نفس العضو+العمل+الفصل+التخصص)، سعر التخصيص ثم العام،
 * ختم month_key بالشهر النشط، تحديث مجموعة members، وتدقيق.
 * body: { userId, work, chapters: string[], types: string[], notes? }
 */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (isResponse(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.userId || typeof body.work !== "string" || !Array.isArray(body.chapters) || !body.chapters.length || !Array.isArray(body.types) || !body.types.length) return json({ error: "بيانات التسجيل ناقصة" }, 400);
    if (body.userId !== auth.id && !auth.isAdmin) return json({ error: "لا يمكنك التسجيل باسم عضو آخر" }, 403);
    const { nativeCommand } = await import("@/lib/native-service");
    const result = await nativeCommand({ action: "register", payload: { userId: body.userId, work: body.work, chapters: body.chapters.join(","), types: body.types.join(","), notes: body.notes || "" } }, auth);
    return json({ ok: true, ...result });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "تعذر التسجيل" }, 400); }
}

/** حذف سجل محدد — يتطابق عبر (userId, work_name, chapter, work_type, timestamp) */
export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  if (!auth.isAdmin) return json({ error: "للمشرفين فقط" }, 403);
  try {
    const body = (await req.json()) as {
      userId?: string;
      work_name?: string;
      chapter?: string;
      work_type?: string;
      timestamp?: string;
    };
    if (!body.userId || !body.work_name || !body.chapter || !body.work_type || !body.timestamp) {
      return json({ error: "تحديد السجل ناقص" }, 400);
    }
    const store = getStore();
    const records = await store.getRecords();
    const entries = records[body.userId] || [];
    const before = entries.length;
    records[body.userId] = entries.filter(
      (e) =>
        !(
          e.work_name === body.work_name &&
          e.chapter === body.chapter &&
          e.work_type === body.work_type &&
          e.timestamp === body.timestamp
        )
    );
    if (records[body.userId].length === before) {
      return json({ error: "السجل غير موجود" }, 404);
    }
    if (records[body.userId].length === 0) delete records[body.userId];
    const saved = await store.saveRecords(records);
    if (!saved) return json({ error: "تعذر الحفظ" }, 503);
    await logAudit(store, "حذف_سجل", auth.id, body.userId, `${body.work_name} — فصل ${body.chapter}`);
    return json({ ok: true });
  } catch (e) {
    console.error("[RECORDS/DELETE]", e);
    return json({ error: "تعذر الحذف" }, 500);
  }
}
