import { test } from "node:test";
import assert from "node:assert/strict";
import { memberProgress } from "../src/lib/progression";
import { demoSnapshot as fixture } from "./fixtures";
test("experience excludes money adjustments and repeats across months, preserves different specialties", () => {
  const s = fixture();
  s.records = [];
  const base = {
    id: "a",
    userId: s.members[0].id,
    work_name: "Work",
    chapter: "2",
    work_type: "ترجمة",
    total: 1,
    notes: "",
    timestamp: "2026-10-01T10:00:00Z",
    month_key: "2026-10",
    username: "Member",
  };
  s.records.push(
    base,
    { ...base, id: "b", month_key: "2026-09" },
    { ...base, id: "c", work_type: "تحرير" },
    { ...base, id: "d", work_type: "مكافأة", chapter: "-" },
  );
  const p = memberProgress(s, base.userId, new Date("2026-10-02T00:00:00Z"));
  assert.equal(p.tasks, 2);
  assert.equal(p.chapters, 1);
  assert.equal(p.xp, 20);
  assert.equal(p.level, 1);
  assert.equal(p.streak, 1);
});
test("level thresholds and earned streak badges derive from saved records only", () => {
  const s = fixture();
  const id = s.members[0].id;
  s.records = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    userId: id,
    work_name: "W",
    chapter: String(i + 1),
    work_type: "ترجمة",
    total: 1,
    notes: "",
    username: "Member",
    month_key: "2026-10",
    timestamp: `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
  }));
  const p = memberProgress(s, id, new Date("2026-10-10T22:00:00Z"));
  assert.equal(p.level, 2);
  assert.equal(p.nextLevelXp, 400);
  assert.equal(p.progress, 0);
  assert.equal(p.streak, 10);
  assert.equal(p.badges.find((b) => b.id === "streak")?.earned, true);
  assert.equal(memberProgress(s, "unknown").xp, 0);
});
