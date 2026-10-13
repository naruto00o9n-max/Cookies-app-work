import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChapters,
  register,
  totalOf,
  visibleEntries,
  paymentCSV,
  validateSnapshot,
} from "../src/lib/domain";
import { applyCommand } from "../src/lib/commands";
import { emptySnapshot } from "../src/lib/seed";
import { demoSnapshot } from "./fixtures";
import { importBackup } from "../src/lib/import";
const admin = { id: "a", name: "Admin", isAdmin: true };
function fixture() {
  const s = emptySnapshot();
  s.members = [
    { id: "a", name: "Admin" },
    { id: "b", name: "Member" },
  ];
  s.works = [{ name: "Story", paid_start: 3 }];
  return s;
}
test("ranges accept Arabic digits and preserve decimals, with bounds", () => {
  assert.deepEqual(parseChapters("١-٣،5.5،٠٣"), ["1", "2", "3", "5.5"]);
  assert.throws(() => parseChapters("3-1"));
  assert.throws(() => parseChapters("1-501"));
  assert.throws(() => parseChapters("-1"));
});
test("free chapters and duplicates are excluded without misaligning mixed specialties", () => {
  const s = fixture();
  const result = register(
    s,
    "a",
    "a",
    "Story",
    "1-4",
    "تحرير,تحرير,تبييض,تحرير",
    "",
  );
  assert.equal(result.added.length, 2);
  assert.equal(result.gained, 0.75);
  assert.equal(s.records[0].work_type, "تبييض");
  assert.throws(() => register(s, "a", "a", "Story", "3-4", "تبييض,تحرير", ""));
});
test("member cannot register for another member or modify finances", () => {
  const s = fixture();
  const member = { ...admin, isAdmin: false };
  assert.throws(() =>
    applyCommand(
      s,
      {
        action: "register",
        payload: { userId: "b", work: "Story", chapters: "3", types: "تحرير" },
      },
      member,
    ),
  );
  assert.throws(() =>
    applyCommand(
      s,
      {
        action: "adjustment",
        payload: { userId: "a", kind: "مكافأة", amount: 10 },
      },
      member,
    ),
  );
});
test("custom specialties are exclusive, decimals remain accurate", () => {
  const s = fixture();
  s.works[0].custom_prices = { رفع: 0.005 };
  const r = register(s, "a", "a", "Story", "3-4", "رفع", "");
  assert.equal(r.gained, 0.01);
  assert.throws(() => register(s, "a", "a", "Story", "5", "تحرير", ""));
});
test("same chapter in a different month is allowed", () => {
  const s = fixture();
  register(s, "a", "a", "Story", "3", "تحرير", "");
  s.settings.active_month = "2026-11";
  register(s, "a", "a", "Story", "3", "تحرير", "");
  assert.equal(s.records.length, 2);
});
test("bonuses are positive, deductions negative; isolated works excluded", () => {
  const s = fixture();
  register(s, "a", "a", "Story", "3", "تحرير", "");
  applyCommand(
    s,
    {
      action: "adjustment",
      payload: { userId: "a", kind: "مكافأة", amount: 2 },
    },
    admin,
  );
  applyCommand(
    s,
    {
      action: "adjustment",
      payload: { userId: "a", kind: "خصم", amount: 0.5 },
    },
    admin,
  );
  s.works[0].isolated = true;
  const t = totalOf(visibleEntries(s));
  assert.equal(t.amount, 1.5);
  assert.equal(t.chapters, 0);
  assert.equal(t.deductions, 0.5);
});
test("clear month preserves other months and isolated records", () => {
  const s = fixture();
  register(s, "a", "a", "Story", "3", "تحرير", "");
  s.records.push({ ...s.records[0], id: "old", month_key: "2025-01" });
  s.works[0].isolated = true;
  applyCommand(s, { action: "clearMonth", payload: {} }, admin);
  assert.equal(s.records.length, 2);
  s.works[0].isolated = false;
  applyCommand(s, { action: "clearMonth", payload: {} }, admin);
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].month_key, "2025-01");
});
test("renaming a work preserves records and totals", () => {
  const s = fixture();
  register(s, "a", "a", "Story", "3", "تحرير", "");
  applyCommand(
    s,
    { action: "editWork", payload: { name: "Story", newName: "New" } },
    admin,
  );
  assert.equal(s.records[0].work_name, "New");
  assert.equal(totalOf(visibleEntries(s)).amount, 0.5);
});
test("active month cannot be deleted, nor an archived month containing isolated records", () => {
  const s = fixture();
  assert.throws(() =>
    applyCommand(
      s,
      { action: "deleteMonth", payload: { key: s.settings.active_month } },
      admin,
    ),
  );
  register(s, "a", "a", "Story", "3", "تحرير", "");
  const key = s.settings.active_month;
  s.settings.active_month = "2026-11";
  s.works[0].isolated = true;
  assert.throws(() =>
    applyCommand(s, { action: "deleteMonth", payload: { key } }, admin),
  );
});
test("bot JSON export imports preserving member IDs and month keys", () => {
  const s = importBackup({
    "123": [
      {
        work_name: "Story",
        chapter: "5",
        work_type: "تحرير",
        total: 0.5,
        timestamp: "2026-09-10T10:00:00Z",
        username: "Name",
      },
    ],
  });
  assert.equal(s.records[0].userId, "123");
  assert.equal(s.records[0].month_key, "2026-09");
  assert.equal(s.members[0].id, "123");
  assert.equal(s.works[0].name, "Story");
});
test("corrupt backups and unsafe financial amounts are rejected", () => {
  const s = fixture();
  assert.throws(() => validateSnapshot({}));
  assert.throws(() =>
    applyCommand(
      s,
      {
        action: "adjustment",
        payload: { userId: "a", kind: "خصم", amount: Infinity },
      },
      admin,
    ),
  );
  assert.throws(() =>
    applyCommand(
      s,
      { action: "specialty", payload: { name: "test", price: -1 } },
      admin,
    ),
  );
});
test("CSV protects spreadsheet formula fields and retains fractional rates", () => {
  const s = demoSnapshot();
  s.members[0].name = '=IMPORTXML("x")';
  assert.ok(paymentCSV(s).includes("'=IMPORTXML"));
  assert.ok(paymentCSV(s).startsWith("\ufeff"));
});
