import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accidentalCatalogWork,
  canAutoAdd,
  catalogDecision,
  catalogPost,
  CATALOG_VERSION,
} from "../src/lib/azora-policy";
import { applyCommand } from "../src/lib/commands";
import { emptySnapshot } from "../src/lib/seed";
import type { Work } from "../src/lib/types";
const state = {
  native_catalog_version: CATALOG_VERSION,
  baseline_done: true,
  listing_v2: true,
  auto_add_new_works: true,
};
const posts = [
  { slug: "old", postTitle: "Old" },
  { slug: "new", postTitle: "New" },
];
test("initial migration, partial listings and catalog expansions never import the historical catalog", () => {
  assert.deepEqual(catalogDecision({}, {}, posts, true).add, []);
  assert.deepEqual(catalogDecision(state, { old: {} }, posts, false).add, []);
  assert.deepEqual(
    catalogDecision({ ...state, listing_v2: false }, { old: {} }, posts, true)
      .add,
    [],
  );
  const batch = Array.from({ length: 11 }, (_, i) => ({
    slug: `story-${i}`,
    postTitle: `Story ${i}`,
  }));
  assert.equal(catalogDecision(state, {}, batch, true).backfill, true);
  assert.deepEqual(catalogDecision(state, {}, batch, true).add, []);
});
test("only truly new slugs after a full baseline are added; disabling auto-add and repeat sync add nothing", () => {
  assert.deepEqual(catalogDecision(state, { old: {} }, posts, true).add, [
    posts[1],
  ]);
  assert.deepEqual(
    catalogDecision(state, { old: {}, new: {} }, posts, true).add,
    [],
  );
  assert.deepEqual(
    catalogDecision(
      { ...state, auto_add_new_works: false },
      { old: {} },
      posts,
      true,
    ).add,
    [],
  );
  assert.equal(canAutoAdd([{ name: "  New   " }], posts[1]), false);
  assert.equal(
    canAutoAdd([{ name: "Translation", azora: { slug: "new" } }], posts[1]),
    false,
  );
});
test("bot catalog fields normalize into actual title and cover; unsafe media is rejected", () => {
  assert.deepEqual(
    catalogPost(
      {
        title_en: "  Story ",
        cover: "https://azorafly.com/cover.jpg",
        post_id: 42,
      },
      "story",
    ),
    {
      slug: "story",
      postTitle: "Story",
      featuredImage: "https://azorafly.com/cover.jpg",
      id: 42,
    },
  );
  assert.equal(catalogPost({ slug: "../../bad" }), null);
  assert.equal(
    catalogPost({ slug: "story", featuredImage: "javascript:bad" })
      ?.featuredImage,
    undefined,
  );
});
test("cleanup only matches unused app bulk imports and protects bot links, manual links, prices and any financial history", () => {
  const work: Work = {
    name: " New",
    active: true,
    paid_start: null,
    azora: {
      slug: "new",
      post_id: 1,
      title_en: " New",
      linked_at: "2026-10-13T12:00:00Z",
    },
  };
  const cache = { new: { postTitle: " New" } };
  assert.equal(accidentalCatalogWork(work, cache, []), true);
  for (const override of [
    { azora: { ...work.azora!, linked_by: "azora-sync" } },
    { azora: { ...work.azora!, linked_by: "moderator" } },
    { paid_start: 5 },
    { isolated: true },
    { custom_prices: { ترجمة: 1 } },
    { active: false },
    { name: "Edited" },
  ])
    assert.equal(
      accidentalCatalogWork({ ...work, ...override }, cache, []),
      false,
    );
  assert.equal(
    accidentalCatalogWork(work, cache, [{ work_name: "New" }]),
    false,
  );
  assert.equal(
    accidentalCatalogWork({ ...work, azora: { slug: "new" } }, cache, []),
    false,
  );
});
test("padded legacy work names register and edit consistently without renaming historic records", () => {
  const s = emptySnapshot(),
    actor = { id: "a", name: "Admin", isAdmin: true };
  s.members = [actor];
  s.works = [{ name: " Story " }];
  applyCommand(
    s,
    {
      action: "register",
      payload: { work: " Story ", chapters: "1", types: "تحرير" },
    },
    actor,
  );
  assert.equal(s.records[0].work_name, " Story ");
  applyCommand(
    s,
    { action: "editWork", payload: { name: " Story ", paid_start: 1 } },
    actor,
  );
  assert.equal(s.works[0].paid_start, 1);
  applyCommand(
    s,
    { action: "azoraLink", payload: { work: " Story ", slug: "story" } },
    actor,
  );
  assert.equal(s.works[0].azora?.linked_by, "a");
  assert.throws(() =>
    applyCommand(
      s,
      { action: "azoraLink", payload: { work: " Story ", slug: "other" } },
      actor,
    ),
  );
  applyCommand(
    s,
    { action: "azoraUnlink", payload: { work: " Story " } },
    actor,
  );
  assert.equal(s.works[0].azora, undefined);
  applyCommand(
    s,
    { action: "editWork", payload: { name: " Story ", newName: "Story" } },
    actor,
  );
  assert.equal(s.records[0].work_name, "Story");
  assert.equal(s.works[0].name, "Story");
});

import {
  Alert,
  closeDialog,
  currentDialog,
  dialogHost,
  registerDialogHost,
} from "../src/lib/alerts";
test("glass dialogs keep cancel actions, queue confirmations and select the active sheet host on iOS", () => {
  const closeRoot = registerDialogHost("root", true),
    closeSheet = registerDialogHost("sheet", false);
  assert.equal(dialogHost(), "sheet");
  let confirmed = false;
  Alert.alert("Confirm", "Details", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Confirm",
      onPress: () => {
        confirmed = true;
      },
    },
  ]);
  Alert.alert("Next");
  const first = currentDialog()!;
  assert.equal(first.buttons.length, 2);
  assert.equal(first.title, "Confirm");
  assert.equal(closeDialog(first.id), true);
  assert.equal(closeDialog(first.id), false);
  assert.equal(confirmed, false);
  assert.equal(currentDialog()?.title, "Next");
  closeSheet();
  assert.equal(dialogHost(), "root");
  closeDialog(currentDialog()!.id);
  closeRoot();
  assert.equal(currentDialog(), null);
});
