import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { guides } from "../src/lib/guides.ts";
const base = process.env.BASE_URL || "http://localhost:3001/app/";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 768, height: 1024 },
});
const page = await context.newPage();
const errors = [],
  commands = [],
  headers = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = {
  version: 1,
  works: [
    { name: "Test Novel", active: true },
    { name: "نظام المكافآت والخصومات" },
  ],
  records: [
    {
      id: "chapter-1",
      userId: "test-admin",
      username: "مشرف الاختبار",
      work_name: "Test Novel",
      chapter: "1",
      work_type: "تحرير",
      total: 20,
      notes: "",
      timestamp: "2026-10-13T10:00:00Z",
      month_key: "2026-10",
    },
    {
      id: "old-bonus",
      userId: "test-admin",
      username: "مشرف الاختبار",
      work_name: "نظام المكافآت والخصومات",
      chapter: "مكافأة",
      work_type: "مكافأة",
      total: 5,
      notes: "Legacy bonus",
      timestamp: "2026-10-13T11:00:00Z",
      month_key: "2026-10",
    },
  ],
  members: [
    {
      id: "test-admin",
      name: "مشرف الاختبار",
      isAdmin: true,
      appRegistered: true,
    },
    {
      id: "test-member",
      name: "عضو الاختبار",
      isAdmin: false,
      appRegistered: true,
    },
  ],
  specialties: { تحرير: { price: 20, active: true } },
  months: [
    { key: "2026-10", name: "أكتوبر" },
    { key: "2026-09", name: "سبتمبر" },
  ],
  settings: {
    currency: "$",
    active_month: "2026-10",
    payment_day: 28,
    payment_hour: 0,
    alert_threshold: 0,
  },
  audit: [],
};
await page.addInitScript(
  (ids) => {
    if (sessionStorage.getItem("features-fixture-seeded")) return;
    sessionStorage.setItem("features-fixture-seeded", "yes");
    localStorage.setItem("cookies:notifications:prompt:test-admin", "later");
    for (const id of ids)
      localStorage.setItem(`cookies:guide:v1:test-admin:${id}`, "seen");
  },
  guides.map((g) => g.id),
);
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  headers.push({
    path: url.pathname,
    authorization: route.request().headers().authorization,
  });
  let body = {};
  if (url.pathname === "/api/auth/me")
    body = {
      authenticated: true,
      user: { id: "test-admin", username: "test", isAdmin: true },
    };
  if (url.pathname === "/api/mobile/state")
    body = {
      snapshot,
      user: { id: "test-admin", username: "test", isAdmin: true },
      mode: "mongo",
    };
  if (url.pathname === "/api/mobile/admin")
    body = {
      members: snapshot.members,
      configuration: { databaseConfigured: true },
    };
  if (url.pathname === "/api/mobile/command") {
    const command = route.request().postDataJSON();
    commands.push(command);
    if (command.action === "adjustment")
      snapshot.records.push({
        id: `adjustment-${commands.length}`,
        userId: command.payload.userId,
        username: "مشرف الاختبار",
        work_name: "مكافآت وخصومات",
        chapter: "-",
        work_type: command.payload.kind,
        total:
          command.payload.kind === "خصم"
            ? -command.payload.amount
            : command.payload.amount,
        notes: command.payload.notes,
        timestamp: "2026-10-14T19:00:00Z",
        month_key: "2026-10",
      });
    body = { message: "تم حفظ العملية المالية" };
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
await page.getByText("مساحتي", { exact: true }).waitFor();
assert.ok(headers.some((h) => h.path === "/api/auth/me"));
assert.ok(
  headers
    .filter((h) => h.path === "/api/mobile/state")
    .every((h) => h.authorization === undefined),
);
await page.getByText("الأعمال", { exact: true }).click();
assert.equal(
  await page.getByText("نظام المكافآت والخصومات", { exact: true }).count(),
  0,
);
await page.getByText("سجلاتي", { exact: true }).click();
assert.equal(await page.getByText("Legacy bonus", { exact: false }).count(), 0);
await page.getByRole("tab", { name: /الفريق/ }).click();
assert.equal(await page.getByText("الخبرة", { exact: true }).count(), 0);
assert.equal(await page.getByText("كل الشهور", { exact: true }).count(), 0);
await page.getByRole("button", { name: "اختيار الفترة", exact: true }).click();
await page.getByText("سبتمبر", { exact: true }).last().click();
await page
  .getByRole("button", { name: "اختيار طريقة الترتيب", exact: true })
  .click();
await page.getByText("الخبرة", { exact: true }).last().click();
await page.getByRole("button", { name: "اختيار التخصص", exact: true }).click();
await page.getByText("تحرير", { exact: true }).last().click();
await page.screenshot({
  path: "/workspace/cookies-artifacts/leaderboard-filters-ipad.png",
  fullPage: true,
});
await page.getByText("مساحتي", { exact: true }).click();
await page.getByText("المستحقات والحركات المالية", { exact: true }).click();
await page
  .getByRole("button", { name: "عملية مالية جديدة", exact: true })
  .click();
await page.getByRole("radio", { name: "تسجيل خصم", exact: true }).click();
await page.getByLabel("مبلغ العملية ($)", { exact: true }).fill("١٢٫٥٠");
await page
  .getByLabel("سبب العملية المالية", { exact: true })
  .fill("اختبار مراجعة الخصم");
await page.screenshot({
  path: "/workspace/cookies-artifacts/deduction-review-ipad.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "مراجعة الخصم وتأكيده", exact: true })
  .click();
assert.equal(commands.length, 0);
await page
  .getByRole("button", { name: "مراجعة التفاصيل", exact: true })
  .click();
assert.equal(commands.length, 0);
await page
  .getByRole("button", { name: "مراجعة الخصم وتأكيده", exact: true })
  .click();
await page.getByRole("button", { name: /^خصم .* من مشرف الاختبار$/ }).click();
await page.getByText("تم تسجيل الخصم", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "عرض الحركات المالية", exact: true })
  .click();
await page.getByText("خصم من المستحقات", { exact: true }).last().waitFor();
assert.equal(commands.length, 1);
assert.equal(commands[0].payload.amount, 12.5);
assert.equal(commands[0].payload.kind, "خصم");
await page
  .getByRole("button", { name: "عملية مالية جديدة", exact: true })
  .click();
await page.getByRole("radio", { name: "إضافة مكافأة", exact: true }).click();
await page.getByLabel("مبلغ العملية ($)", { exact: true }).fill("2.5");
await page
  .getByLabel("سبب العملية المالية", { exact: true })
  .fill("اختبار المكافأة");
await page
  .getByRole("button", { name: "مراجعة المكافأة وتأكيدها", exact: true })
  .click();
await page
  .getByRole("button", { name: /^إضافة .* إلى مشرف الاختبار$/ })
  .click();
await page
  .getByRole("button", { name: "عرض الحركات المالية", exact: true })
  .click();
assert.equal(commands[1].payload.kind, "مكافأة");
await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("مساحتي", { exact: true }).click();
await page.getByText("دليل الاستخدام", { exact: true }).click();
await page
  .getByLabel("ماذا تريد أن تتعلم؟", { exact: true })
  .fill("مكافأة أم خصم");
await page
  .getByRole("button", { name: "تعلم مكافأة أم خصم؟", exact: true })
  .click();
await page.getByRole("button", { name: "التالي", exact: true }).click();
await page.getByRole("button", { name: "التالي", exact: true }).click();
await page.getByRole("button", { name: "فهمت، لنبدأ", exact: true }).click();
// An unseen screen teaches once, then stays dismissed across reloads.
await page.evaluate(() =>
  localStorage.removeItem("cookies:guide:v1:test-admin:works"),
);
await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("الأعمال", { exact: true }).click();
await page.getByText("ابحث واختر", { exact: true }).waitFor();
await page.screenshot({
  path: "/workspace/cookies-artifacts/tutorial-ipad.png",
  fullPage: true,
});
await page.getByRole("button", { name: "تخطي الشرح", exact: true }).click();
await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("الأعمال", { exact: true }).click();
await page.waitForTimeout(1100);
assert.equal(await page.getByText("ابحث واختر", { exact: true }).count(), 0);
assert.deepEqual(errors, []);
console.log(
  "Shared web app: cookie login, compact month/metric/specialty filters, separated legacy finance, explicit deduction/bonus confirmation and tutorial persistence passed.",
);
await browser.close();
