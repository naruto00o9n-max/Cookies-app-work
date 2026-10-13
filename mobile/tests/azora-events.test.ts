import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newPublishedChapters,
  workRecipients,
  azoraMetadata,
} from "../../dashboard/src/lib/azora-events";
test("first sync is a baseline; repeated sync has no alerts, new decimal and backfilled chapters are detected", () => {
  const current = [
    { number: "1" },
    { number: "1.5" },
    { number: "3" },
    { number: "3.0" },
  ];
  assert.deepEqual(newPublishedChapters(undefined, current), []);
  assert.deepEqual(newPublishedChapters([1, 3], current), ["1.5"]);
  assert.deepEqual(newPublishedChapters([1, 1.5, 3], current), []);
  assert.deepEqual(newPublishedChapters([], current), ["1", "1.5", "3"]);
});
test("notify contributors only, excluding adjustments, unrelated members, and already completed chapter", () => {
  const records = {
    translator: [{ work_name: "Work", work_type: "ترجمة", chapter: "1" }],
    editor: [{ work_name: "Work", work_type: "تحرير", chapter: "1" }],
    completed: [{ work_name: "Work", work_type: "ترجمة", chapter: "2" }],
    bonus: [{ work_name: "Work", work_type: "مكافأة", chapter: "-" }],
    unrelated: [{ work_name: "Other", work_type: "ترجمة", chapter: "1" }],
  };
  assert.deepEqual(workRecipients(records, { name: "Work" }, "2"), [
    "translator",
    "editor",
  ]);
  assert.deepEqual(
    workRecipients(records, { name: "Work", paid_start: 3 }, "2"),
    [],
  );
  assert.deepEqual(
    workRecipients(records, { name: "Work", isolated: true }, "2"),
    [],
  );
  assert.deepEqual(
    workRecipients(records, { name: "Work", active: false }, "2"),
    [],
  );
});
test("use Azora actual cover and sanitize description without generating fake media", () => {
  const result = azoraMetadata(
    {
      featuredImage: "https://storage.azorafly.com/cover.webp",
      postTitle: "Title",
      postContent: "<p>Story &amp; team</p>",
    },
    [{ number: "1" }, { number: "2.5" }],
  );
  assert.equal(result.cover, "https://storage.azorafly.com/cover.webp");
  assert.equal(result.description, "Story & team");
  assert.equal(result.latestChapter, "2.5");
  assert.equal(
    azoraMetadata({ featuredImage: "javascript:alert(1)" }, []).cover,
    undefined,
  );
});
