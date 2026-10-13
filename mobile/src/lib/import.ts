import { emptySnapshot } from "./seed";
import { uid, validateSnapshot } from "./domain";
import type { Snapshot } from "./types";
export function importBackup(raw: unknown): Snapshot {
  const value = raw as Record<string, any>;
  if (value?.version === 1) return validateSnapshot(value);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("الملف غير صالح");
  const records = value.records || value,
    s = emptySnapshot();
  for (const [userId, entries] of Object.entries(records)) {
    if (!Array.isArray(entries)) throw new Error("قسم السجلات غير صالح");
    for (const e of entries) {
      if (!e || typeof e !== "object") throw new Error("سجل غير صالح");
      s.records.push({
        ...e,
        id: uid(),
        userId,
        notes: e.notes || "",
        username: e.username || userId,
        month_key:
          e.month_key ||
          (e.timestamp ? e.timestamp.slice(0, 7) : s.settings.active_month),
      });
    }
    s.members.push({
      id: userId,
      name: entries.find((e) => e.username)?.username || userId,
    });
  }
  s.works = Array.isArray(value.works)
    ? value.works
    : [
        ...new Set(
          s.records
            .filter((e) => !["مكافأة", "خصم"].includes(e.work_type))
            .map((e) => e.work_name),
        ),
      ].map((name) => ({ name, paid_start: null }));
  if (value.settings) {
    s.settings = { ...s.settings, ...value.settings };
    s.specialties = value.settings.specialties || s.specialties;
  }
  s.months = [
    ...new Set([s.settings.active_month, ...s.records.map((e) => e.month_key)]),
  ].map((key) => ({ key, name: key }));
  return validateSnapshot(s);
}
