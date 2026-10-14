import { test } from "node:test";
import assert from "node:assert/strict";
import { validSubscription } from "../../dashboard/src/lib/web-push-policy";
const keys = {
  p256dh: Buffer.alloc(65, 4).toString("base64url"),
  auth: Buffer.alloc(16, 2).toString("base64url"),
};
test("web subscriptions accept known HTTPS push providers and reject private or attacker endpoints", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/wpush/v2/test",
    "https://web.push.apple.com/test",
  ])
    assert.equal(validSubscription({ endpoint, keys }), true);
  for (const endpoint of [
    "https://127.0.0.1/test",
    "http://fcm.googleapis.com/test",
    "https://fcm.googleapis.com.attacker.example/test",
    "https://user@fcm.googleapis.com/test",
    "https://fcm.googleapis.com:8443/test",
  ])
    assert.equal(validSubscription({ endpoint, keys }), false);
  assert.equal(
    validSubscription({
      endpoint: "https://fcm.googleapis.com/test",
      keys: { p256dh: "bad", auth: "bad" },
    }),
    false,
  );
});
