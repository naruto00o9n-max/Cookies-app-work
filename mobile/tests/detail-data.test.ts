import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chapterGroups,
  contributionSummary,
  specialtyGroups,
} from "../src/lib/detail-data";
import type { Entry } from "../src/lib/types";

const entry = (id: string, patch: Partial<Entry> = {}): Entry => ({
  id,
  userId: "one",
  username: "Member",
  work_name: "Story",
  chapter: "12",
  work_type: "ترجمة",
  timestamp: "2026-10-13T10:00:00Z",
  month_key: "2026-10",
  notes: "",
  total: 1,
  ...patch,
});

test("detail counts distinct chapters separately from specialties, people, months, and adjustments", () => {
  const records = [
    entry("translate"),
    entry("edit", { userId: "two", chapter: "012", work_type: "تحرير" }),
    entry("older", { month_key: "2026-09", timestamp: "2026-09-20T10:00:00Z" }),
    entry("other-work", { work_name: "Another Story" }),
    entry("bonus", { work_type: "مكافأة", chapter: "-", total: 10 }),
    entry("deduction", { work_type: "خصم", chapter: "-", total: -2 }),
  ];
  const result = contributionSummary(records);
  assert.equal(result.chapters, 2);
  assert.equal(result.tasks, 4);
  assert.equal(result.members, 2);
  assert.equal(result.works, 2);
  assert.equal(result.amount, 4);
  const groups = chapterGroups(records);
  assert.equal(groups.length, 2);
  const story = groups.find((group) => group.work === "Story")!;
  assert.equal(story.chapter, "12");
  assert.equal(story.entries.length, 3);
  assert.deepEqual(
    new Set(story.entries.map((item) => item.work_type)),
    new Set(["ترجمة", "تحرير"]),
  );
  const roles = specialtyGroups(records);
  assert.equal(roles.find((role) => role.role === "ترجمة")?.chapters, 2);
  assert.equal(
    roles.some((role) => role.role === "مكافأة"),
    false,
  );
});

test("chapter drill-down preserves decimal numbers and can switch between chapter order and recent activity", () => {
  const records = [
    entry("ten", { chapter: "10", timestamp: "2026-10-13T10:00:00Z" }),
    entry("two", { chapter: "2", timestamp: "2026-10-11T10:00:00Z" }),
    entry("decimal", { chapter: "2.5", timestamp: "2026-10-12T10:00:00Z" }),
    entry("decimal-before", {
      chapter: "2.05",
      timestamp: "2026-10-10T10:00:00Z",
    }),
  ];
  assert.deepEqual(
    chapterGroups(records, true).map((group) => group.chapter),
    ["2", "2.05", "2.5", "10"],
  );
  assert.deepEqual(
    chapterGroups(records).map((group) => group.chapter),
    ["10", "2.5", "2", "2.05"],
  );
  assert.equal(records[0].id, "ten");
});
