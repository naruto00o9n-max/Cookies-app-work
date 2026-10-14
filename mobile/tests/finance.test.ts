import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustmentPreview,
  isFinancialEntry,
  presentationSnapshot,
} from "../src/lib/finance";
import { emptySnapshot } from "../src/lib/seed";
import { applyCommand } from "../src/lib/commands";
import { totalOf } from "../src/lib/domain";
test("deduction and bonus previews use a positive input, Arabic numbers and explicit operation", () => {
  const deduction = adjustmentPreview("١٢٫٥٠", "خصم", 100);
  assert.equal(deduction.after, 87.5);
  assert.equal(deduction.delta, -12.5);
  assert.equal(adjustmentPreview("۱۲.۵", "مكافأة", 100).after, 112.5);
  for (const [amount, kind] of [
    ["12", ""],
    ["-12", "خصم"],
    ["0", "خصم"],
    ["1.2345", "خصم"],
  ])
    assert.equal(adjustmentPreview(amount, kind, 100).valid, false);
});
test("legacy financial labels are excluded from the visible work catalog without changing saved records", () => {
  const snapshot = emptySnapshot();
  snapshot.works = [{ name: "نظام المكافآت والخصومات" }, { name: "Novel" }];
  snapshot.records = [
    {
      id: "bonus",
      userId: "1",
      username: "Member",
      work_name: "نظام المكافآت والخصومات",
      chapter: "مكافأة",
      work_type: "مكافأة",
      total: 5,
      notes: "Legacy",
      month_key: "2026-10",
      timestamp: "2026-10-13",
    },
  ];
  const view = presentationSnapshot(snapshot);
  assert.deepEqual(
    view.works.map((w) => w.name),
    ["Novel"],
  );
  assert.equal(view.records, snapshot.records);
  assert.equal(snapshot.works.length, 2);
  assert.equal(isFinancialEntry(snapshot.records[0]), true);
  assert.equal(totalOf(view.records).amount, 5);
  snapshot.records.push({
    ...snapshot.records[0],
    id: "chapter",
    chapter: "1",
    work_type: "تحرير",
  });
  assert.equal(presentationSnapshot(snapshot).works.length, 2);
});
test("financial operation changes the signed balance and never creates a novel or a chapter achievement", () => {
  const snapshot = emptySnapshot();
  snapshot.members = [{ id: "member", name: "Member" }];
  const actor = { id: "admin", name: "Admin", isAdmin: true };
  applyCommand(
    snapshot,
    {
      action: "adjustment",
      payload: { userId: "member", kind: "خصم", amount: 12.5, notes: "Reason" },
    },
    actor,
  );
  assert.equal(totalOf(snapshot.records).amount, -12.5);
  assert.equal(totalOf(snapshot.records).chapters, 0);
  assert.equal(snapshot.works.length, 0);
  assert.equal(snapshot.records[0].added_by, "admin");
});
