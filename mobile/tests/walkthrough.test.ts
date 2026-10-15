import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  walkthroughNext,
  walkthroughCheckpoint,
  walkthroughKey,
  readWalkthrough,
  type WalkthroughStep,
} from "../src/lib/walkthrough";
test("journey advances on actual member actions and only successful registration leads to profile", () => {
  let step: WalkthroughStep = "start";
  step = walkthroughNext(step, "registration-opened");
  assert.equal(step, "work");
  step = walkthroughNext(step, "work-selected");
  assert.equal(step, "chapter");
  step = walkthroughNext(step, "chapter-entered");
  assert.equal(step, "specialty");
  step = walkthroughNext(step, "specialty-selected");
  assert.equal(step, "save");
  assert.equal(walkthroughNext(step, "profile-opened"), "save");
  assert.equal(walkthroughNext(step, "leaderboard-opened"), "save");
  step = walkthroughNext(step, "registration-succeeded");
  assert.equal(step, "profile");
  step = walkthroughNext(step, "profile-opened");
  assert.equal(step, "leaderboard");
  step = walkthroughNext(step, "leaderboard-opened");
  assert.equal(step, "finish");
  assert.equal(walkthroughCheckpoint(step), "done");
});
test("unfinished forms restart safely; completion and dismissal persist separately per member", () => {
  assert.notEqual(walkthroughKey("alice"), walkthroughKey("bob"));
  for (const step of [
    "start",
    "work",
    "chapter",
    "specialty",
    "save",
  ] as WalkthroughStep[])
    assert.equal(readWalkthrough(walkthroughCheckpoint(step)), "start");
  assert.equal(readWalkthrough(null), "start");
  assert.equal(readWalkthrough("old-admin-guide"), "start");
  assert.equal(readWalkthrough("profile"), "profile");
  assert.equal(readWalkthrough("leaderboard"), "leaderboard");
  assert.equal(walkthroughNext("chapter", "dismiss"), "done");
  assert.equal(walkthroughNext("done", "registration-opened"), "done");
});
test("old tutorial content and its dialog entry points are absent from shipped sources", () => {
  const root = new URL("../", import.meta.url);
  for (const file of [
    "src/lib/guides.ts",
    "src/lib/use-guide.ts",
    "src/components/GuideTour.tsx",
    "src/screens/GuideBook.tsx",
  ])
    assert.equal(existsSync(new URL(file, root)), false);
  for (const file of [
    "App.tsx",
    "src/lib/alerts.ts",
    "src/components/GlassDialogHost.tsx",
    "src/screens/Control.tsx",
    "src/screens/More.tsx",
  ])
    assert.doesNotMatch(
      readFileSync(new URL(file, root), "utf8"),
      /useScreenGuide|showGuide|GuideBook|GuideTour|navigate\("Help"\)/,
    );
});
