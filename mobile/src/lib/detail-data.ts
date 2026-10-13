import type { Entry } from "./types";

export const isChapterTask = (entry: Entry) =>
  !["مكافأة", "خصم"].includes(entry.work_type) && entry.chapter !== "-";

const chapterKey = (chapter: string) => {
  const number = Number(chapter);
  return chapter.trim() && Number.isFinite(number)
    ? String(number)
    : chapter.trim();
};
const compareChapters = (a: string, b: string) => {
  const first = Number(a),
    second = Number(b);
  return Number.isFinite(first) && Number.isFinite(second)
    ? first - second
    : a.localeCompare(b, undefined, { numeric: true });
};

export function contributionSummary(entries: Entry[]) {
  const tasks = entries.filter(isChapterTask);
  return {
    tasks: tasks.length,
    chapters: new Set(
      tasks.map((entry) =>
        JSON.stringify([entry.work_name, chapterKey(entry.chapter)]),
      ),
    ).size,
    works: new Set(tasks.map((entry) => entry.work_name)).size,
    members: new Set(tasks.map((entry) => entry.userId)).size,
    specialties: [...new Set(tasks.map((entry) => entry.work_type))],
    amount: tasks.reduce((sum, entry) => sum + entry.total, 0),
  };
}

export function chapterGroups(entries: Entry[], byChapterNumber = false) {
  const groups = new Map<
    string,
    { id: string; work: string; chapter: string; entries: Entry[] }
  >();
  for (const entry of entries.filter(isChapterTask)) {
    const chapter = chapterKey(entry.chapter);
    const id = JSON.stringify([entry.work_name, chapter]);
    const group = groups.get(id) || {
      id,
      work: entry.work_name,
      chapter,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      ),
    }))
    .sort((a, b) =>
      byChapterNumber
        ? a.work.localeCompare(b.work) || compareChapters(a.chapter, b.chapter)
        : b.entries[0].timestamp.localeCompare(a.entries[0].timestamp),
    );
}

export function specialtyGroups(entries: Entry[]) {
  const roles = [
    ...new Set(entries.filter(isChapterTask).map((e) => e.work_type)),
  ];
  return roles
    .map((role) => {
      const items = entries.filter((entry) => entry.work_type === role);
      return { role, ...contributionSummary(items) };
    })
    .sort((a, b) => b.tasks - a.tasks);
}
