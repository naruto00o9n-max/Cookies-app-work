import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Alert,
  closeDialog,
  currentDialog,
  dialogHost,
  registerDialogHost,
} from "../src/lib/alerts";
test("screen and sheet hosts take over without leaving an invisible dialog blocker", () => {
  const root = registerDialogHost("root", true),
    screen = registerDialogHost("screen", false);
  Alert.alert("delete", "confirm", [
    { text: "cancel" },
    { text: "delete", style: "destructive" },
  ]);
  assert.equal(dialogHost(), "screen");
  const first = currentDialog()!;
  assert.equal(closeDialog(first.id), true);
  assert.equal(closeDialog(first.id), false);
  assert.equal(currentDialog(), null);
  const sheet = registerDialogHost("sheet", false);
  Alert.alert("sheet confirmation");
  assert.equal(dialogHost(), "sheet");
  sheet();
  assert.equal(dialogHost(), "screen");
  closeDialog(currentDialog()!.id);
  Alert.alert("saved");
  screen();
  assert.equal(dialogHost(), "root");
  closeDialog(currentDialog()!.id);
  root();
  assert.equal(dialogHost(), null);
  assert.equal(currentDialog(), null);
});
