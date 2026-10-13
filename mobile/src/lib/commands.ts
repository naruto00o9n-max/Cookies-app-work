import { findWork, workKey } from "./work-lookup";
import {
  parseChapters,
  priceOf,
  register,
  uid,
  validateSnapshot,
} from "./domain";
import type { Entry, Identity, Snapshot } from "./types";
export type Command = {
  id?: string;
  action: string;
  payload: Record<string, unknown>;
};
const text = (p: Record<string, unknown>, key: string) =>
  String(p[key] ?? "").trim();
function number(p: Record<string, unknown>, key: string, min = 0) {
  const v = Number(p[key]);
  if (!text(p, key) || !Number.isFinite(v) || v < min)
    throw new Error("قيمة رقمية غير صالحة");
  return v;
}
export function applyCommand(
  s: Snapshot,
  command: Command,
  actor: Identity,
  verifiedPublication = false,
): {
  message: string;
  added?: string[];
  skipped?: { chapter: string; reason: string }[];
  gained?: number;
} {
  const { action, payload: p } = command;
  if (
    ["specialty", "customPrice", "removeCustom"].includes(action) &&
    (["__proto__", "constructor", "prototype"].includes(text(p, "name")) ||
      /[.$]/.test(text(p, "name")))
  )
    throw new Error("اسم التخصص غير صالح");
  if (!["register", "editLast"].includes(action) && !actor.isAdmin)
    throw new Error("هذه العملية للمشرفين فقط");
  let message = "تم حفظ التغييرات";
  let receipt: {
    added?: string[];
    skipped?: { chapter: string; reason: string }[];
    gained?: number;
  } = {};
  switch (action) {
    case "register": {
      const target = text(p, "userId") || actor.id;
      if (target !== actor.id && !actor.isAdmin)
        throw new Error("لا يمكنك التسجيل باسم عضو آخر");
      if (!s.members.some((m) => m.id === target))
        throw new Error("العضو غير موجود");
      const result = register(
        s,
        target,
        actor.id,
        String(p.work ?? ""),
        text(p, "chapters"),
        text(p, "types"),
        text(p, "notes"),
        verifiedPublication,
      );
      receipt = {
        added: result.added.map((e) => e.chapter),
        skipped: result.skipped.map((line) => ({
          chapter: line.split(":")[0],
          reason: line.split(":")[1] || "",
        })),
        gained: result.gained,
      };
      message = `تم تسجيل ${result.added.length} فصل · ${s.settings.currency}${result.gained.toFixed(3)}${result.skipped.length ? "\n" + result.skipped.join("\n") : ""}`;
      break;
    }
    case "editLast": {
      const target = actor.id;
      const entries = s.records
        .filter(
          (e) =>
            e.userId === target &&
            e.month_key === s.settings.active_month &&
            !["مكافأة", "خصم"].includes(e.work_type),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const e = entries[0];
      if (!e) throw new Error("لا توجد سجلات لتعديلها هذا الشهر");
      const w = findWork(s.works, String(p.work || e.work_name));
      if (
        !w ||
        w.isolated ||
        w.active === false ||
        (w.azora && !verifiedPublication)
      )
        throw new Error("العمل غير متاح للتعديل المحلي");
      const chapter = text(p, "chapter") || e.chapter;
      if (
        !Number.isFinite(Number(chapter)) ||
        Number(chapter) < (w.paid_start ?? 0)
      )
        throw new Error("الفصل غير صالح أو مجاني");
      const type = text(p, "types") || e.work_type;
      if (
        s.records.some(
          (x) =>
            x.id !== e.id &&
            x.userId === target &&
            x.month_key === e.month_key &&
            x.work_name === w.name &&
            Number(x.chapter) === Number(chapter) &&
            x.work_type === type,
        )
      )
        throw new Error("الفصل مسجل مسبقًا");
      e.total = priceOf(s, w, type);
      e.work_name = w.name;
      e.chapter = String(Number(chapter));
      e.work_type = type;
      if (p.notes !== undefined) e.notes = text(p, "notes");
      break;
    }
    case "adjustment": {
      const userId = text(p, "userId"),
        kind = text(p, "kind");
      if (
        !s.members.some((m) => m.id === userId) ||
        !["مكافأة", "خصم"].includes(kind)
      )
        throw new Error("بيانات العضو أو العملية غير صالحة");
      const amount = number(p, "amount", 0.001);
      s.records.push({
        id: uid(),
        userId,
        username: s.members.find((m) => m.id === userId)!.name,
        work_name: "مكافآت وخصومات",
        work_type: kind,
        chapter: "-",
        total: kind === "خصم" ? -amount : amount,
        notes: text(p, "notes"),
        timestamp: new Date().toISOString(),
        month_key: s.settings.active_month,
        added_by: actor.id,
      });
      break;
    }
    case "editRecord": {
      const entry = s.records.find((e) => e.id === text(p, "id"));
      if (!entry)
        throw new Error("السجل غير موجود؛ حدّث البيانات ثم حاول مجددًا");
      if (["مكافأة", "خصم"].includes(entry.work_type)) {
        if (p.notes !== undefined) entry.notes = text(p, "notes");
        if (
          (p.chapter !== undefined && text(p, "chapter") !== entry.chapter) ||
          (p.types !== undefined && text(p, "types") !== entry.work_type) ||
          (p.work !== undefined && text(p, "work") !== entry.work_name)
        )
          throw new Error(
            "لتغيير تسوية مالية، احذفها ثم أضف التسوية الصحيحة من القسم المالي",
          );
        break;
      }
      const target = text(p, "userId") || entry.userId,
        person = s.members.find((m) => m.id === target);
      if (!person) throw new Error("العضو غير موجود");
      const requestedWork = String(p.work || entry.work_name),
        work = findWork(s.works, requestedWork)?.name || requestedWork,
        type = text(p, "types") || entry.work_type;
      const chapter = text(p, "chapter") || entry.chapter;
      const selectedChapters = parseChapters(chapter);
      if (selectedChapters.length !== 1)
        throw new Error("اختر فصلًا واحدًا لتعديل هذا السجل");
      const parsed = Number(selectedChapters[0]);
      if (!Number.isFinite(parsed) || parsed < 0)
        throw new Error("رقم الفصل غير صالح");
      const canonical = String(parsed),
        changed =
          work !== entry.work_name ||
          type !== entry.work_type ||
          canonical !== String(Number(entry.chapter));
      const selected = findWork(s.works, work);
      if (changed) {
        if (!selected || selected.isolated || selected.active === false)
          throw new Error("العمل غير متاح للتعديل");
        if (selected.azora && !verifiedPublication)
          throw new Error("يتطلب الفصل التحقق من أزورا");
        if (parsed < (selected.paid_start ?? 0)) throw new Error("الفصل مجاني");
        entry.total = priceOf(s, selected, type);
      }
      if (
        s.records.some(
          (e) =>
            e.id !== entry.id &&
            e.userId === target &&
            e.month_key === entry.month_key &&
            e.work_name === work &&
            Number(e.chapter) === parsed &&
            e.work_type === type,
        )
      )
        throw new Error("الفصل والتخصص مسجلان بالفعل لهذا العضو في الشهر نفسه");
      entry.userId = target;
      entry.username = person.name;
      entry.work_name = work;
      entry.chapter = canonical;
      entry.work_type = type;
      if (p.notes !== undefined) entry.notes = text(p, "notes");
      message = "تم تحديث السجل وإعادة حساب المستحقات";
      break;
    }
    case "deleteRecord": {
      const index = s.records.findIndex((e) => e.id === text(p, "id"));
      if (index < 0) throw new Error("السجل غير موجود");
      s.records.splice(index, 1);
      break;
    }
    case "addWork": {
      const name = text(p, "name");
      if (!name || s.works.some((w) => workKey(w.name) === workKey(name)))
        throw new Error("اسم العمل فارغ أو موجود مسبقًا");
      s.works.push({
        name,
        active: true,
        paid_start: text(p, "paid_start") ? number(p, "paid_start") : null,
      });
      break;
    }
    case "editWork": {
      const w = findWork(s.works, String(p.name ?? ""));
      if (!w) throw new Error("العمل غير موجود");
      const newName = text(p, "newName");
      if (newName && newName !== w.name) {
        if (
          s.works.some((x) => x !== w && workKey(x.name) === workKey(newName))
        )
          throw new Error("الاسم مستخدم");
        s.records.forEach((e) => {
          if (e.work_name === w.name) e.work_name = newName;
        });
        w.name = newName;
      }
      if (p.paid_start !== undefined)
        w.paid_start = text(p, "paid_start") ? number(p, "paid_start") : null;
      if (typeof p.isolated === "boolean") w.isolated = p.isolated;
      if (typeof p.active === "boolean") w.active = p.active;
      break;
    }
    case "deleteWork": {
      const w = findWork(s.works, String(p.name ?? ""));
      if (!w || w.isolated) throw new Error("العمل غير موجود أو معزول");
      s.works = s.works.filter((x) => x !== w);
      break;
    }
    case "specialty": {
      const name = text(p, "name").replace(/\s+/g, "_");
      if (!name || ["مكافأة", "خصم"].includes(name))
        throw new Error("اسم تخصص غير صالح");
      const sp = s.specialties[name];
      s.specialties[name] = {
        price: p.price !== undefined ? number(p, "price") : (sp?.price ?? 0),
        active: typeof p.active === "boolean" ? p.active : (sp?.active ?? true),
      };
      break;
    }
    case "customPrice": {
      const w = findWork(s.works, String(p.work ?? "")),
        name = text(p, "name");
      if (!w || !name) throw new Error("العمل والتخصص مطلوبان");
      w.custom_prices ||= {};
      w.custom_prices[name] = number(p, "price");
      if (p.move === true) delete s.specialties[name];
      break;
    }
    case "removeCustom": {
      const w = findWork(s.works, String(p.work ?? "")),
        name = text(p, "name");
      if (!w?.custom_prices || !(name in w.custom_prices))
        throw new Error("التخصيص غير موجود");
      if (p.toGlobal === true)
        s.specialties[name] = { price: w.custom_prices[name], active: true };
      delete w.custom_prices[name];
      if (!Object.keys(w.custom_prices).length) delete w.custom_prices;
      break;
    }
    case "azoraLink": {
      const w = findWork(s.works, String(p.work ?? "")),
        slug = text(p, "slug");
      if (!w || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug))
        throw new Error("العمل أو سلاغ أزورا غير صالح");
      if (s.works.some((x) => x !== w && x.azora?.slug === slug))
        throw new Error("هذا العمل مرتبط بالفعل");
      if (w.azora?.slug)
        throw new Error("فك الربط الحالي أولًا قبل اختيار عمل آخر");
      w.azora = {
        slug,
        linked_by: actor.id,
        linked_at: new Date().toISOString(),
      };
      break;
    }
    case "azoraUnlink": {
      const w = findWork(s.works, String(p.work ?? ""));
      if (!w) throw new Error("العمل غير موجود");
      delete w.azora;
      break;
    }
    case "clearCustom": {
      const w = findWork(s.works, String(p.work ?? ""));
      if (!w) throw new Error("العمل غير موجود");
      delete w.custom_prices;
      break;
    }
    case "reprice": {
      const from = text(p, "from"),
        to = text(p, "to");
      if (
        (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
        (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) ||
        (from && to && from > to)
      )
        throw new Error("نطاق التاريخ غير صالح");
      let count = 0;
      for (const e of s.records) {
        if (
          ["مكافأة", "خصم"].includes(e.work_type) ||
          (p.all !== true && e.month_key !== s.settings.active_month)
        )
          continue;
        if (text(p, "name") && e.work_type !== text(p, "name")) continue;
        if (
          (from && e.timestamp.slice(0, 10) < from) ||
          (to && e.timestamp.slice(0, 10) > to)
        )
          continue;
        const w = s.works.find((w) => w.name === e.work_name);
        if (!w || w.isolated) continue;
        try {
          e.total = priceOf(s, w, e.work_type);
          count++;
        } catch {
          /* Disabled historical specialties retain their amount. */
        }
      }
      message = `تم تحديث أسعار ${count} سجل`;
      break;
    }
    case "month": {
      const key = text(p, "key");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))
        throw new Error("صيغة الشهر: YYYY-MM");
      let m = s.months.find((m) => m.key === key);
      if (!m) {
        m = { key, name: text(p, "name") || key };
        s.months.push(m);
      }
      if (text(p, "name")) m.name = text(p, "name");
      if (p.activate === true) s.settings.active_month = key;
      break;
    }
    case "deleteMonth": {
      const key = text(p, "key");
      if (key === s.settings.active_month)
        throw new Error("فعّل شهرًا آخر قبل حذف الشهر النشط");
      const isolated = new Set(
        s.works.filter((w) => w.isolated).map((w) => w.name),
      );
      if (
        s.records.some((e) => e.month_key === key && isolated.has(e.work_name))
      )
        throw new Error("هذا الشهر يحتوي سجلات معزولة محفوظة");
      s.records = s.records.filter((e) => e.month_key !== key);
      s.months = s.months.filter((m) => m.key !== key);
      break;
    }
    case "clearMonth": {
      const isolated = new Set(
        s.works.filter((w) => w.isolated).map((w) => w.name),
      );
      s.records = s.records.filter(
        (e) =>
          e.month_key !== s.settings.active_month ||
          isolated.has(e.work_name) ||
          (text(p, "userId") && e.userId !== text(p, "userId")),
      );
      break;
    }
    case "clearWorks":
      s.works = s.works.filter((w) => w.isolated);
      break;
    case "settings": {
      if (text(p, "currency"))
        s.settings.currency = text(p, "currency").slice(0, 8);
      if (p.payment_day !== undefined) {
        const day = text(p, "payment_day") ? number(p, "payment_day", 1) : null;
        if (day !== null && (!Number.isInteger(day) || day > 28))
          throw new Error("يوم الدفع بين 1 و28");
        s.settings.payment_day = day;
      }
      if (p.payment_hour !== undefined) {
        const hour = number(p, "payment_hour");
        if (!Number.isInteger(hour) || hour > 23)
          throw new Error("الساعة بين 0 و23");
        s.settings.payment_hour = hour;
      }
      if (p.alert_threshold !== undefined)
        s.settings.alert_threshold = number(p, "alert_threshold");
      break;
    }
    case "import": {
      const next = validateSnapshot(p.snapshot);
      Object.assign(s, next);
      break;
    }
    default:
      throw new Error("عملية غير معروفة");
  }
  s.audit.unshift({
    id: uid(),
    action,
    details: message,
    moderator_id: actor.id,
    timestamp: new Date().toISOString(),
  });
  s.audit = s.audit.slice(0, 1000);
  return { message, ...receipt };
}
