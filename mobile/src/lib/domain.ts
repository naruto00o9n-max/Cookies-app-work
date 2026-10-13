import type { Entry, Snapshot, Totals, Work } from "./types";
export const monthKey = () => new Date().toISOString().slice(0, 7);
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export function parseChapters(input: string): string[] {
  const text = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/،/g, ",");
  const chapters: string[] = [];
  for (const part of text.split(",")) {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]),
        end = Number(range[2]);
      if (end < start || end - start > 499)
        throw new Error("النطاق غير صالح؛ الحد الأقصى 500 فصل");
      for (let n = start; n <= end; n++) chapters.push(String(n));
    } else {
      const n = Number(part.trim());
      if (!part.trim() || !Number.isFinite(n) || n < 0)
        throw new Error("اكتب رقمًا أو نطاقًا مثل 1-5 أو 1،3،5");
      chapters.push(String(n));
    }
    if (chapters.length > 500) throw new Error("الحد الأقصى 500 فصل");
  }
  return [...new Set(chapters)];
}
export function allowedSpecialties(s: Snapshot, w?: Work): string[] {
  if (w?.custom_prices) return Object.keys(w.custom_prices);
  return Object.keys(s.specialties).filter((k) => s.specialties[k].active);
}
export function priceOf(s: Snapshot, w: Work, specialty: string): number {
  if (!allowedSpecialties(s, w).includes(specialty))
    throw new Error("التخصص غير متاح لهذا العمل");
  const price = w.custom_prices?.[specialty] ?? s.specialties[specialty]?.price;
  if (!Number.isFinite(price) || price! < 0)
    throw new Error("سعر التخصص غير صالح");
  return price!;
}
export function visibleEntries(
  s: Snapshot,
  member?: string,
  month = s.settings.active_month,
): Entry[] {
  const isolated = new Set(
    s.works.filter((w) => w.isolated).map((w) => w.name),
  );
  return s.records.filter(
    (e) =>
      (!member || e.userId === member) &&
      (!month || e.month_key === month) &&
      !isolated.has(e.work_name),
  );
}
export function totalOf(entries: Entry[]): Totals {
  const real = entries.filter((e) => !["مكافأة", "خصم"].includes(e.work_type));
  return {
    chapters: real.length,
    amount: entries.reduce((a, e) => a + e.total, 0),
    bonuses: entries
      .filter((e) => e.work_type === "مكافأة")
      .reduce((a, e) => a + e.total, 0),
    deductions: -entries
      .filter((e) => e.work_type === "خصم")
      .reduce((a, e) => a + e.total, 0),
    works: new Set(real.map((e) => e.work_name)).size,
  };
}
export function register(
  s: Snapshot,
  userId: string,
  actor: string,
  workName: string,
  chaptersInput: string,
  typesInput: string,
  notes: string,
  verifiedPublication = false,
) {
  const work = s.works.find((w) => w.name === workName);
  if (!work || work.isolated || work.active === false)
    throw new Error("العمل غير متاح للتسجيل");
  const chapters = parseChapters(chaptersInput);
  const types = typesInput
    .split(/[,،]/)
    .map((t) => t.trim().replace(/\s+/g, "_"))
    .filter(Boolean);
  if (types.length !== 1 && types.length !== chapters.length)
    throw new Error("اختر تخصصًا واحدًا أو تخصصًا لكل فصل بالترتيب");
  const added: Entry[] = [],
    skipped: string[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i],
      type = types.length === 1 ? types[0] : types[i];
    if (work.paid_start != null && Number(chapter) < work.paid_start) {
      skipped.push(`الفصل ${chapter}: مجاني`);
      continue;
    }
    const total = priceOf(s, work, type);
    if (
      s.records.some(
        (e) =>
          e.userId === userId &&
          e.work_name === workName &&
          Number(e.chapter) === Number(chapter) &&
          e.work_type === type &&
          e.month_key === s.settings.active_month,
      )
    ) {
      skipped.push(`الفصل ${chapter}: مسجل مسبقًا`);
      continue;
    }
    // Linked works require online publication verification before a shared save.
    if (work.azora && !verifiedPublication)
      throw new Error(
        "هذا العمل مرتبط بأزورا ويحتاج تحققًا عبر الإنترنت قبل التسجيل",
      );
    added.push({
      id: uid(),
      userId,
      work_name: workName,
      chapter,
      work_type: type,
      total,
      notes,
      timestamp: new Date().toISOString(),
      month_key: s.settings.active_month,
      username: s.members.find((m) => m.id === userId)?.name || userId,
      added_by: actor,
    });
  }
  if (!added.length) throw new Error(skipped.join("\n") || "لم يسجل أي فصل");
  s.records.push(...added);
  return { added, skipped, gained: added.reduce((a, e) => a + e.total, 0) };
}
export function validateSnapshot(value: unknown): Snapshot {
  const s = value as Snapshot;
  const key = (v: unknown) =>
    typeof v === "string" &&
    v.length > 0 &&
    v.length < 201 &&
    !["__proto__", "constructor", "prototype"].includes(v) &&
    !/[.$]/.test(v);
  const month = (v: unknown) =>
    typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.records) ||
    !Array.isArray(s.works) ||
    !Array.isArray(s.members) ||
    !Array.isArray(s.months) ||
    !s.settings ||
    !s.specialties ||
    Array.isArray(s.specialties) ||
    !Array.isArray(s.audit)
  )
    throw new Error("ملف النسخة الاحتياطية غير صالح");
  if (s.records.length > 100000) throw new Error("الملف أكبر من الحد المسموح");
  if (
    !month(s.settings.active_month) ||
    typeof s.settings.currency !== "string" ||
    !Number.isFinite(s.settings.alert_threshold) ||
    s.settings.alert_threshold < 0 ||
    !Number.isInteger(s.settings.payment_hour) ||
    s.settings.payment_hour < 0 ||
    s.settings.payment_hour > 23 ||
    (s.settings.payment_day !== null &&
      (!Number.isInteger(s.settings.payment_day) ||
        s.settings.payment_day < 1 ||
        s.settings.payment_day > 28))
  )
    throw new Error("إعدادات النسخة غير صالحة");
  for (const e of s.records)
    if (
      !key(e.id) ||
      !key(e.userId) ||
      typeof e.work_name !== "string" ||
      typeof e.chapter !== "string" ||
      typeof e.work_type !== "string" ||
      !Number.isFinite(e.total) ||
      !month(e.month_key) ||
      !Number.isFinite(Date.parse(e.timestamp))
    )
      throw new Error("يوجد سجل غير صالح");
  if (new Set(s.records.map((e) => e.id)).size !== s.records.length)
    throw new Error("معرفات السجلات مكررة");
  for (const w of s.works) {
    if (
      typeof w.name !== "string" ||
      !w.name ||
      (w.paid_start != null &&
        (!Number.isFinite(w.paid_start) || w.paid_start < 0))
    )
      throw new Error("يوجد عمل غير صالح");
    if (w.custom_prices)
      for (const [name, price] of Object.entries(w.custom_prices))
        if (!key(name) || !Number.isFinite(price) || price < 0)
          throw new Error("سعر مخصص غير صالح");
  }
  for (const [name, sp] of Object.entries(s.specialties))
    if (
      !key(name) ||
      !Number.isFinite(sp.price) ||
      sp.price < 0 ||
      typeof sp.active !== "boolean"
    )
      throw new Error("يوجد سعر غير صالح");
  for (const m of s.members)
    if (!key(m.id) || typeof m.name !== "string")
      throw new Error("يوجد عضو غير صالح");
  for (const m of s.months)
    if (!month(m.key) || typeof m.name !== "string")
      throw new Error("يوجد شهر غير صالح");
  for (const a of s.audit)
    if (
      typeof a.action !== "string" ||
      typeof a.details !== "string" ||
      !Number.isFinite(Date.parse(a.timestamp))
    )
      throw new Error("يوجد سجل إدارة غير صالح");
  return s;
}
export function paymentCSV(s: Snapshot): string {
  const cell = (v: string | number) =>
    `"${String(v)
      .replace(/^[=+\-@]/, "'$&")
      .replace(/"/g, '""')}"`;
  const rows = [
    ["العضو", "الفصول", "الأعمال", "المكافآت", "الخصومات", "الصافي", "العملة"],
    ...s.members.map((m) => {
      const t = totalOf(visibleEntries(s, m.id));
      return [
        m.name,
        t.chapters,
        t.works,
        t.bonuses.toFixed(3),
        t.deductions.toFixed(3),
        t.amount.toFixed(3),
        s.settings.currency,
      ];
    }),
  ];
  return "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
