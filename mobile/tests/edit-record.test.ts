import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSnapshot } from "./fixtures";
import { applyCommand } from "../src/lib/commands";
test("admin edits one historical record; notes only preserve its agreed old price", () => {
  const s = demoSnapshot(),
    e = s.records[0];
  e.month_key = "2025-01";
  e.total = 0.731;
  const result = applyCommand(
    s,
    { action: "editRecord", payload: { id: e.id, notes: "Corrected note" } },
    { id: s.members[1].id, name: "Admin", isAdmin: true },
  );
  assert.equal(e.total, 0.731);
  assert.equal(e.month_key, "2025-01");
  assert.equal(e.notes, "Corrected note");
  assert.match(result.message, /تحديث/);
});
test("edit record is admin-only and cannot create an identical member chapter specialty in a month", () => {
  const s = demoSnapshot(),
    e = s.records[0];
  s.records = [e, { ...e, id: "other", chapter: "999" }];
  assert.throws(
    () =>
      applyCommand(
        s,
        { action: "editRecord", payload: { id: "other", chapter: e.chapter } },
        { id: e.userId, name: "Member", isAdmin: false },
      ),
    /للمشرفين/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { action: "editRecord", payload: { id: "other", chapter: e.chapter } },
        { id: e.userId, name: "Admin", isAdmin: true },
      ),
    /بالفعل/,
  );
});
test("financial adjustment editing does not turn a bonus into a chapter", () => {
  const s = demoSnapshot(),
    e = s.records[0];
  e.work_type = "مكافأة";
  e.work_name = "مكافآت وخصومات";
  e.chapter = "-";
  assert.throws(
    () =>
      applyCommand(
        s,
        { action: "editRecord", payload: { id: e.id, chapter: "1" } },
        { id: e.userId, name: "Admin", isAdmin: true },
      ),
    /تسوية/,
  );
});
