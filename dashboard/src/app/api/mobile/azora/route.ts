import { after } from "next/server";
import { json, requireAdmin, isResponse } from "@/lib/api";
import { azoraState, syncAzora, reserveAzoraSync } from "@/lib/azora-native";
import { nativeDb } from "@/lib/native-service";
export const maxDuration = 300;
export async function GET() {
  const user = await requireAdmin();
  if (isResponse(user)) return user;
  try {
    return json(await azoraState());
  } catch {
    return json({ error: "تعذر قراءة أزورا" }, 503);
  }
}
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (isResponse(user)) return user;
  try {
    const p = await req.json();
    if (p.action === "sync") {
      const started = await reserveAzoraSync();
      if (started)
        after(async () => {
          try {
            await syncAzora(true);
          } catch {
            /* Persisted job status is shown in the app. */
          }
        });
      return json(
        {
          message: started
            ? "بدأ تحديث أزورا في الخلفية؛ يمكنك متابعة استخدام التطبيق"
            : "المزامنة تعمل بالفعل",
          syncing: true,
        },
        202,
      );
    }
    if (p.action === "settings") {
      const db = nativeDb();
      if (!db) return json({ error: "لم يتم إعداد قاعدة البيانات" }, 503);
      const fields: Record<string, unknown> = {};
      if (typeof p.team_slug === "string") {
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(p.team_slug))
          throw new Error("اسم الفريق غير صالح");
        const current = await db
          .collection("azora")
          .findOne({ _id: "state" as never });
        if ((current?.team_slug || "cookies") !== p.team_slug) {
          const job = await db
            .collection("azora")
            .findOne({ _id: "mobile-sync" as never });
          if (
            job?.status === "running" &&
            Number(new Date(job.expires_at)) > Date.now()
          )
            throw new Error("انتظر انتهاء المزامنة قبل تغيير الفريق");
          fields.team_slug = p.team_slug;
          fields.team_id = null;
          fields.baseline_done = false;
          fields.listing_v2 = false;
          fields.native_catalog_version = 0;
          await db
            .collection("azora")
            .updateOne(
              { _id: "cache" as never },
              { $set: { works: {} } },
              { upsert: true },
            );
        }
      }
      for (const key of ["enabled", "auto_add_new_works"])
        if (typeof p[key] === "boolean") fields[key] = p[key];
      if (Object.keys(fields).length)
        await db
          .collection("azora")
          .updateOne(
            { _id: "state" as never },
            { $set: fields },
            { upsert: true },
          );
      return json({ message: "تم تحديث إعدادات أزورا" });
    }
    return json({ error: "عملية غير معروفة" }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "تعذرت المزامنة" },
      503,
    );
  }
}
