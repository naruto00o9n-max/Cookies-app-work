import type { Entry, Snapshot } from "./types";
export const isFinancialEntry = (entry: Entry) =>
  entry.work_type === "مكافأة" || entry.work_type === "خصم";
const legacyFinancialNames = new Set([
  "نظام المكافآت والخصومات",
  "مكافآت وخصومات",
  "المكافآت والخصومات",
]);
export function presentationSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    works: snapshot.works.filter(
      (work) =>
        !legacyFinancialNames.has(work.name) ||
        snapshot.records.some(
          (entry) => entry.work_name === work.name && !isFinancialEntry(entry),
        ),
    ),
  };
}
export function adjustmentPreview(
  amount: string,
  kind: string,
  current: number,
) {
  const normalized = amount
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace("٫", ".");
  const value = /^\d+(?:\.\d{1,3})?$/.test(normalized)
    ? Number(normalized)
    : NaN;
  const valid =
    Number.isFinite(value) &&
    value >= 0.001 &&
    value <= 1_000_000 &&
    ["مكافأة", "خصم"].includes(kind);
  const delta = valid ? (kind === "خصم" ? -value : value) : 0;
  return {
    valid,
    amount: value,
    delta,
    before: current,
    after: current + delta,
  };
}
