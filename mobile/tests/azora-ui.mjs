import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
// Only browser test responses are mocked. No preview login or sample dataset is shipped.
const snapshot = {
  version: 1,
  records: [],
  works: [
    { name: "Team Novel", active: true },
    {
      name: "Linked Novel",
      active: true,
      azora: { slug: "linked", chapterCount: 5 },
    },
  ],
  members: [{ id: "test-admin", name: "مشرف الاختبار", isAdmin: true }],
  specialties: { تحرير: { price: 0.25, active: true } },
  months: [{ key: "2026-10", name: "أكتوبر" }],
  settings: {
    currency: "$",
    active_month: "2026-10",
    payment_day: null,
    payment_hour: 0,
    alert_threshold: 0,
  },
  audit: [],
};
const data = {
  state: {
    team_slug: "cookies",
    enabled: true,
    auto_add_new_works: true,
    baseline_done: true,
    syncing: false,
  },
  posts: [
    { slug: "novel", postTitle: "Azora Novel" },
    { slug: "linked", postTitle: "Linked Novel" },
    { slug: "catalog-only", postTitle: "Catalog Only" },
  ],
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ serviceWorkers: "block", viewport: { width: 768, height: 1024 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  sessionStorage.setItem("cookies.token", "browser-test");
  localStorage.setItem("cookies:notifications:prompt:test-admin", "later");
  for (const id of ["home", "more", "azora", "azora-link"])
    localStorage.setItem(`cookies:guide:v1:test-admin:${id}`, "seen");
});
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  if (url.pathname === "/api/mobile/state")
    body = {
      snapshot,
      user: { id: "test-admin", username: "test", isAdmin: true },
      mode: "mongo",
    };
  else if (url.pathname === "/api/mobile/azora")
    body =
      route.request().method() === "POST"
        ? { message: "Test sync started", syncing: true }
        : data;
  else if (url.pathname === "/api/mobile/command")
    body = { message: "تم الربط" };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    },
    body: JSON.stringify(body),
  });
});
await page.goto(process.env.BASE_URL || "http://localhost:3000/app/", {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.getByText("مساحتي", { exact: true }).click();
await page.getByText("مركز أزورا", { exact: true }).click();
await page.getByText("ربط عمل بأزورا", { exact: true }).click();
await page.getByText("اختر عملًا غير مرتبط", { exact: true }).click();
await page.getByText("Team Novel", { exact: true }).waitFor();
assert.equal(await page.getByText("Linked Novel", { exact: true }).count(), 0);
assert.equal(await page.getByText("Catalog Only", { exact: true }).count(), 0);
await page.getByText("Team Novel", { exact: true }).click();
await page.getByText("ابحث في أعمال فريق أزورا", { exact: true }).click();
await page.getByPlaceholder("اكتب الاسم للبحث…").fill("Azora");
await page.getByText("Azora Novel", { exact: true }).click();
await page.screenshot({
  path: "/workspace/cookies-artifacts/azora-link-ipad.png",
  fullPage: true,
});
await page.getByRole("button", { name: "تأكيد الربط", exact: true }).click();
await page.getByText("تأكيد ربط العمل", { exact: true }).waitFor();
await page.waitForTimeout(700);
await page.screenshot({
  path: "/workspace/cookies-artifacts/glass-confirmation-ipad.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "مراجعة الاختيار", exact: true })
  .click();
await page.getByRole("button", { name: "تأكيد الربط", exact: true }).click();
await page
  .getByRole("button", { name: "تأكيد الربط", exact: true })
  .last()
  .click();
await page.getByText("تم الربط", { exact: true }).first().waitFor();
assert.deepEqual(errors, []);
console.log(
  "Azora flow: unlinked Mongo works only, searched catalog selection, glass confirmation/cancel/success passed.",
);
await browser.close();
