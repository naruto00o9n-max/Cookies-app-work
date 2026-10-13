import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pushError,
  pushStep,
  singleFlight,
  PushRegistrationError,
} from "../src/lib/notification-registration";
test("network and Expo failures never claim the iOS signature is invalid", () => {
  for (const stage of ["device", "expo", "server"] as const) {
    const error = pushError(stage, "ios", new Error("Network request failed"));
    assert.equal(error.stage, stage);
    assert.doesNotMatch(error.message, /لا تحتوي صلاحية|أعد التوقيع/);
  }
});
test("an explicit missing APNs entitlement is identified only at the iOS device stage", () => {
  const raw = new Error(
    "no valid aps-environment entitlement string found for application",
  );
  assert.match(pushError("device", "ios", raw).message, /لا تحتوي صلاحية APNs/);
  assert.doesNotMatch(
    pushError("expo", "ios", raw).message,
    /لا تحتوي صلاحية APNs/,
  );
  assert.doesNotMatch(
    pushError("device", "android", raw).message,
    /لا تحتوي صلاحية APNs/,
  );
});
test("a hung native registration expires with a recoverable stage error", async () => {
  await assert.rejects(
    pushStep("device", "ios", () => new Promise(() => {}), 15),
    (error: unknown) =>
      error instanceof PushRegistrationError && error.stage === "device",
  );
  assert.equal(
    await pushStep("device", "ios", async () => "next-attempt", 15),
    "next-attempt",
  );
});
test("concurrent registration callers share one request and can retry after failure", async () => {
  let calls = 0;
  let release: () => void = () => {};
  const register = singleFlight(async () => {
    calls++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    if (calls === 1) throw new Error("offline");
    return "token";
  });
  const a = register(),
    b = register();
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  await assert.rejects(a, /offline/);
  await assert.rejects(b, /offline/);
  const retry = register();
  await Promise.resolve();
  release();
  assert.equal(await retry, "token");
  assert.equal(calls, 2);
});
