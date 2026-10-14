import { test } from "node:test";
import assert from "node:assert/strict";
import { guides, screenGuideId, guideStorageKey } from "../src/lib/guides";
import {
  closeDialog,
  currentDialog,
  discardDialog,
  showGuide,
  Alert,
} from "../src/lib/alerts";
test("tutorials have unique identities and teach each main and admin screen without sharing user progress", () => {
  assert.equal(new Set(guides.map((g) => g.id)).size, guides.length);
  for (const guide of guides) {
    assert.ok(guide.steps.length >= 2);
    assert.ok(
      guide.steps.every((step) => step.body && step.title && step.icon),
    );
  }
  assert.notEqual(
    guideStorageKey("first", "works"),
    guideStorageKey("second", "works"),
  );
  assert.equal(screenGuideId("Detail", { work: "Novel" }), "work-detail");
  assert.equal(screenGuideId("Detail", { member: "Member" }), "member-detail");
  assert.equal(
    screenGuideId("ControlSection", { section: "records" }),
    "control-records",
  );
});
test("leaving a screen removes its pending tutorial without discarding another confirmation", () => {
  Alert.alert("confirmation");
  const confirmation = currentDialog()!.id;
  const tutorial = showGuide(guides[0]);
  assert.equal(discardDialog(tutorial), true);
  assert.equal(currentDialog()!.id, confirmation);
  closeDialog(confirmation);
  assert.equal(currentDialog(), null);
  const shown = showGuide(guides[0]);
  assert.equal(currentDialog()!.guide?.id, "home");
  discardDialog(shown);
  assert.equal(currentDialog(), null);
});
