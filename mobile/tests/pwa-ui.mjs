import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:3002/app/";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const home = await page.goto(new URL("/", base).href, {
  waitUntil: "networkidle",
});
assert.equal(home.status(), 200);
assert.equal(new URL(page.url()).pathname, "/app/");
await page
  .getByRole("button", { name: "الدخول بحساب ديسكورد", exact: true })
  .waitFor();
const manifest = await (
  await context.request.get(new URL("manifest.webmanifest", base).href)
).json();
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "/");
assert.equal(manifest.icons.length, 2);
const registration = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  const worker = r.active;
  if (worker?.state !== "activated")
    await new Promise((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve(null);
      });
    });
  return { scope: r.scope, active: worker?.state };
});
assert.ok(registration.scope.endsWith("/app/"));
assert.equal(registration.active, "activated");
const requests = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = [];
  for (const name of names)
    for (const request of await (await caches.open(name)).keys())
      out.push(new URL(request.url).pathname);
  return out;
});
assert.ok(requests.includes("/app/index.html"));
assert.ok(requests.some((p) => p.endsWith(".ttf")));
assert.ok(!requests.some((p) => p.startsWith("/api/")));
for (const path of ["/api/mobile/state", "/api/mobile/web-devices"]) {
  const response = await context.request.get(new URL(path, base).href);
  assert.equal(response.status(), 401);
}
const crossSite = await context.request.post(
  new URL("/api/auth/logout", base).href,
  { headers: { Origin: "https://attacker.example" }, data: {} },
);
assert.equal(crossSite.status(), 403);
await page
  .getByRole("button", { name: "إضافة إلى الشاشة الرئيسية", exact: true })
  .click();
await page.getByText("Cookies على شاشتك الرئيسية", { exact: true }).waitFor();
await page.getByRole("button", { name: "حسنًا", exact: true }).click();
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page
  .getByRole("button", { name: "الدخول بحساب ديسكورد", exact: true })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  "PWA: root redirect, standalone manifest, active service worker, cached fonts/offline shell, install instructions, private API auth and cross-origin rejection passed.",
);
await b.close();
