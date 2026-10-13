import { getStore } from "@/lib/store";
import { isMonthKey, currentMonthKey } from "@/lib/store/types";
import { getActiveMonth } from "@/lib/agg";
import { json, requireAuth, isResponse } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  try {
    const store = getStore();
    const [settings, { key, name }] = await Promise.all([store.getSettings(), getActiveMonth(store)]);
    return json({
      settings: {
        currency: settings.currency || "$",
        alert_threshold: settings.alert_threshold ?? 10,
        allowed_channels: settings.allowed_channels || [],
        payment_day: settings.payment_day ?? null,
        payment_hour: settings.payment_hour ?? 0,
        active_month: key,
      },
      activeMonthName: name,
    });
  } catch (e) {
    console.error("[SETTINGS/GET]", e);
    return json({ error: "تعذر قراءة الإعدادات" }, 503);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  if (!auth.isAdmin) return json({ error: "للمشرفين فقط" }, 403);
  try {
    const body = (await req.json()) as {
      payment_day?: number | null;
      payment_hour?: number;
      allowed_channels?: (number | string)[];
      currency?: string;
      alert_threshold?: number;
      active_month?: string;
    };
    const store = getStore();
    const settings = await store.getSettings();
    if (typeof body.currency === "string" && body.currency.trim()) {
      settings.currency = body.currency.trim().slice(0, 4);
    }
    if (typeof body.alert_threshold === "number" && body.alert_threshold >= 0) {
      settings.alert_threshold = body.alert_threshold;
    }
    if (typeof body.active_month === "string" && isMonthKey(body.active_month)) {
      settings.active_month = body.active_month;
    } else if (body.active_month === null) {
      settings.active_month = currentMonthKey();
    }
    if (body.payment_day !== undefined) {
      if (body.payment_day !== null && (!Number.isInteger(body.payment_day) || body.payment_day < 1 || body.payment_day > 28)) return json({ error: "يوم الدفع بين 1 و28" }, 400);
      settings.payment_day = body.payment_day;
    }
    if (body.payment_hour !== undefined) {
      if (!Number.isInteger(body.payment_hour) || body.payment_hour < 0 || body.payment_hour > 23) return json({ error: "الساعة بين 0 و23 (UTC)" }, 400);
      settings.payment_hour = body.payment_hour;
    }
    if (body.allowed_channels !== undefined) settings.allowed_channels = body.allowed_channels.slice(0, 2);
    const saved = await store.saveSettings(settings);
    if (!saved) return json({ error: "تعذر الحفظ" }, 503);
    await logAudit(store, "تعديل_إعدادات", auth.id, null, JSON.stringify(body).slice(0, 200));
    return json({ ok: true });
  } catch (e) {
    console.error("[SETTINGS/PATCH]", e);
    return json({ error: "تعذر التعديل" }, 500);
  }
}
