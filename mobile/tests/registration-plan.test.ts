import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addSelectedChapters,
  chaptersForEntry,
  readRegistrationPreferences,
  registrationPreview,
  registrationTypesInput,
  rememberRegistrationChoice,
  resolveChapterSpecialties,
} from "../src/lib/registration-plan";
import { emptySnapshot } from "../src/lib/seed";
import { register } from "../src/lib/domain";

test("chapter picker handles Arabic ranges and decimal selections without duplicates", () => {
  assert.deepEqual(chaptersForEntry("range", "", "٣", "٥", []), [
    "3",
    "4",
    "5",
  ]);
  assert.deepEqual(addSelectedChapters(["3", "5.5"], "٣،٤،5.5"), [
    "3",
    "5.5",
    "4",
  ]);
  assert.throws(() => chaptersForEntry("single", "1-3", "", "", []));
  assert.throws(() => chaptersForEntry("range", "", "4", "", []));
  assert.throws(() => addSelectedChapters(["0"], "1-500"));
});
test("mixed selection follows chapter identity through insertions and excludes stale specialty choices", () => {
  const types = resolveChapterSpecialties(
    ["1", "2", "3", "4"],
    { "2": "تبييض", "3": "قديم" },
    "تحرير",
    ["تحرير", "تبييض"],
  );
  assert.deepEqual(types, ["تحرير", "تبييض", "تحرير", "تحرير"]);
  assert.equal(registrationTypesInput(types), "تحرير,تبييض,تحرير,تحرير");
  assert.equal(registrationTypesInput(["تحرير", "تحرير"]), "تحرير");
  assert.throws(() => registrationTypesInput(["تحرير", ""]));
});
test("registration estimate matches the actual receipt for free, duplicate and mixed chapters", () => {
  const snapshot = emptySnapshot();
  snapshot.members = [{ id: "a", name: "A" }];
  const work = { name: "Story", paid_start: 3 };
  snapshot.works = [work];
  register(snapshot, "a", "a", "Story", "3", "تحرير", "");
  const chapters = ["1", "2", "3", "4", "5"],
    types = ["تحرير", "تبييض", "تحرير", "تبييض", "تحرير"];
  const preview = registrationPreview(snapshot, work, "a", chapters, types);
  assert.deepEqual(
    preview.map((row) => row.status),
    ["free", "free", "duplicate", "ready", "ready"],
  );
  const receipt = register(
    snapshot,
    "a",
    "a",
    "Story",
    chapters.join(","),
    registrationTypesInput(types),
    "",
  );
  assert.equal(
    preview.reduce((sum, row) => sum + row.amount, 0),
    receipt.gained,
  );
  assert.equal(
    preview.filter((row) => row.status === "ready").length,
    receipt.added.length,
  );
});
test("recent preferences survive malformed storage and remember distinct work-specific specialties", () => {
  let preferences = readRegistrationPreferences("invalid-json");
  preferences = rememberRegistrationChoice(preferences, "Story", "تحرير");
  preferences = rememberRegistrationChoice(preferences, "Other", "تبييض");
  preferences = rememberRegistrationChoice(preferences, "Story", "تحرير");
  const restored = readRegistrationPreferences(JSON.stringify(preferences));
  assert.deepEqual(restored.works, ["Story", "Other"]);
  assert.equal(restored.byWork.Story, "تحرير");
  assert.equal(restored.byWork.Other, "تبييض");
  assert.deepEqual(
    readRegistrationPreferences(
      '{"works":[1,"Story","Story"],"specialties":null}',
    ).works,
    ["Story"],
  );
});
