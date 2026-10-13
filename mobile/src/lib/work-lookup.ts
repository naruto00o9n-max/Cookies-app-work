import type { Work } from "./types";
export const workKey = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function findWork(works: Work[], name: string) {
  const exact = works.find((w) => w.name === name);
  if (exact) return exact;
  const matches = works.filter((w) => workKey(w.name) === workKey(name));
  if (matches.length > 1)
    throw new Error(
      "يوجد أكثر من عمل باسم متشابه؛ اختر الاسم الكامل من القائمة",
    );
  return matches[0];
}
