import { allowedSpecialties, parseChapters, priceOf } from "./domain";
import type { Snapshot, Work } from "./types";

export type ChapterEntryMode = "single" | "range" | "selected";
export type RegistrationPreferences = {
  works: string[];
  specialties: string[];
  byWork: Record<string, string>;
};

export const emptyRegistrationPreferences = (): RegistrationPreferences => ({
  works: [],
  specialties: [],
  byWork: {},
});

export function readRegistrationPreferences(
  raw: string | null,
): RegistrationPreferences {
  try {
    const value = raw ? JSON.parse(raw) : null;
    const names = (list: unknown) =>
      Array.isArray(list)
        ? [
            ...new Set(
              list.filter(
                (v): v is string => typeof v === "string" && !!v.trim(),
              ),
            ),
          ].slice(0, 12)
        : [];
    const byWork: Record<string, string> = Object.create(null);
    if (
      value?.byWork &&
      typeof value.byWork === "object" &&
      !Array.isArray(value.byWork)
    ) {
      for (const [work, specialty] of Object.entries(value.byWork).slice(
        0,
        50,
      )) {
        if (typeof specialty === "string" && specialty.trim())
          byWork[work] = specialty;
      }
    }
    return {
      works: names(value?.works),
      specialties: names(value?.specialties),
      byWork,
    };
  } catch {
    return emptyRegistrationPreferences();
  }
}

export function rememberRegistrationChoice(
  previous: RegistrationPreferences,
  work?: string,
  specialty?: string,
): RegistrationPreferences {
  const recent = (value: string | undefined, list: string[]) =>
    value
      ? [value, ...list.filter((name) => name !== value)].slice(0, 12)
      : list;
  return {
    works: recent(work, previous.works),
    specialties: recent(specialty, previous.specialties),
    byWork:
      work && specialty
        ? { ...previous.byWork, [work]: specialty }
        : previous.byWork,
  };
}

export function chaptersForEntry(
  mode: ChapterEntryMode,
  single: string,
  from: string,
  to: string,
  selected: string[],
): string[] {
  if (mode === "selected")
    return selected.length ? parseChapters(selected.join(",")) : [];
  if (mode === "range") {
    if (!from.trim() && !to.trim()) return [];
    if (!from.trim() || !to.trim())
      throw new Error("حدد أول فصل وآخر فصل في النطاق");
    return parseChapters(`${from.trim()}-${to.trim()}`);
  }
  if (!single.trim()) return [];
  const chapters = parseChapters(single);
  if (chapters.length !== 1)
    throw new Error("استخدم النطاق أو الفصول المتفرقة لتسجيل أكثر من فصل");
  return chapters;
}

export function addSelectedChapters(
  previous: string[],
  input: string,
): string[] {
  const added = parseChapters(input);
  return parseChapters([...previous, ...added].join(","));
}

export function resolveChapterSpecialties(
  chapters: string[],
  choices: Record<string, string>,
  fallback: string,
  allowed: string[],
): string[] {
  return chapters.map((chapter) =>
    allowed.includes(choices[chapter])
      ? choices[chapter]
      : allowed.includes(fallback)
        ? fallback
        : "",
  );
}

export function registrationTypesInput(types: string[]): string {
  if (!types.length || types.some((type) => !type))
    throw new Error("اختر تخصصًا لكل فصل قبل الحفظ");
  return new Set(types).size === 1 ? types[0] : types.join(",");
}

export type RegistrationPreviewRow = {
  chapter: string;
  specialty: string;
  amount: number;
  status: "ready" | "free" | "duplicate" | "unassigned";
};

export function registrationPreview(
  snapshot: Snapshot,
  work: Work,
  userId: string,
  chapters: string[],
  specialties: string[],
): RegistrationPreviewRow[] {
  const allowed = allowedSpecialties(snapshot, work);
  const registered = new Set(
    snapshot.records
      .filter(
        (entry) =>
          entry.userId === userId &&
          entry.work_name === work.name &&
          entry.month_key === snapshot.settings.active_month,
      )
      .map((entry) => `${Number(entry.chapter)}\u0000${entry.work_type}`),
  );
  return chapters.map((chapter, index) => {
    const specialty = specialties[index] || "";
    const row = { chapter, specialty, amount: 0 };
    if (!allowed.includes(specialty)) return { ...row, status: "unassigned" };
    if (work.paid_start != null && Number(chapter) < work.paid_start)
      return { ...row, status: "free" };
    if (registered.has(`${Number(chapter)}\u0000${specialty}`))
      return { ...row, status: "duplicate" };
    return {
      ...row,
      amount: priceOf(snapshot, work, specialty),
      status: "ready",
    };
  });
}
