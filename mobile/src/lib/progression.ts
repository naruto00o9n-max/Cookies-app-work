import type { Snapshot } from "./types";
export type ProgressBadge = {
  id: string;
  title: string;
  icon:
    | "sparkles-outline"
    | "layers-outline"
    | "trophy-outline"
    | "diamond-outline"
    | "color-palette-outline"
    | "planet-outline"
    | "flame-outline";
  earned: boolean;
};
export function memberProgress(
  snapshot: Snapshot,
  userId: string,
  now = new Date(),
) {
  const records = snapshot.records.filter(
    (e) =>
      e.userId === userId &&
      !["مكافأة", "خصم"].includes(e.work_type) &&
      Number.isFinite(Number(e.chapter)) &&
      e.chapter !== "-",
  );
  // Repeating the same chapter/specialty in another month does not farm experience.
  const taskKeys = new Set(
    records.map((e) =>
      JSON.stringify([e.work_name, String(Number(e.chapter)), e.work_type]),
    ),
  );
  const chapterKeys = new Set(
    records.map((e) =>
      JSON.stringify([e.work_name, String(Number(e.chapter))]),
    ),
  );
  const tasks = taskKeys.size,
    chapters = chapterKeys.size;
  const works = new Set(records.map((e) => e.work_name)).size,
    roles = new Set(records.map((e) => e.work_type)).size;
  const xp = tasks * 10,
    level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const levelFloorXp = (level - 1) ** 2 * 100,
    nextLevelXp = level ** 2 * 100;
  const progress = (xp - levelFloorXp) / (nextLevelXp - levelFloorXp);
  const tier =
    level >= 20
      ? "أسطوري"
      : level >= 10
        ? "ماسي"
        : level >= 5
          ? "ذهبي"
          : level >= 3
            ? "فضي"
            : "برونزي";
  const title =
    snapshot.members.find((m) => m.id === userId)?.title ||
    (level >= 20
      ? "أسطورة الفصول"
      : level >= 10
        ? "صانع العوالم"
        : level >= 5
          ? "نجم الفريق"
          : level >= 3
            ? "حرفي الفصول"
            : "موهبة صاعدة");
  const today = now.toISOString().slice(0, 10);
  const days = [
    ...new Set(
      records
        .map((e) => e.timestamp.slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today),
    ),
  ].sort();
  let maxStreak = 0,
    chain = 0,
    previous = 0;
  for (const day of days) {
    const epoch = Date.parse(day);
    if (!Number.isFinite(epoch)) continue;
    chain = epoch - previous === 86400000 ? chain + 1 : 1;
    maxStreak = Math.max(maxStreak, chain);
    previous = epoch;
  }
  let streak = 0;
  const seen = new Set(days),
    cursor = new Date(`${today}T00:00:00Z`);
  if (!seen.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (seen.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const badges: ProgressBadge[] = [
    {
      id: "first",
      title: "البداية الأولى",
      icon: "sparkles-outline",
      earned: tasks >= 1,
    },
    {
      id: "ten",
      title: "عشرة فصول",
      icon: "layers-outline",
      earned: chapters >= 10,
    },
    {
      id: "fifty",
      title: "خمسون فصلًا",
      icon: "trophy-outline",
      earned: chapters >= 50,
    },
    {
      id: "hundred",
      title: "نادي المئة",
      icon: "diamond-outline",
      earned: chapters >= 100,
    },
    {
      id: "versatile",
      title: "متعدد المواهب",
      icon: "color-palette-outline",
      earned: roles >= 3,
    },
    {
      id: "worlds",
      title: "خمسة عوالم",
      icon: "planet-outline",
      earned: works >= 5,
    },
    {
      id: "streak",
      title: "أسبوع متواصل",
      icon: "flame-outline",
      earned: maxStreak >= 7,
    },
  ];
  return {
    xp,
    level,
    title,
    tier,
    progress,
    nextLevelXp,
    levelFloorXp,
    chapters,
    tasks,
    streak,
    maxStreak,
    works,
    roles,
    badges,
  };
}
