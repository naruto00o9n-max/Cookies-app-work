import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
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
let registrationFails = true;
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
      isAdmin: false,
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
await page.addInitScript(() => {
  if (sessionStorage.getItem("features-fixture-seeded")) return;
  sessionStorage.setItem("features-fixture-seeded", "yes");
  localStorage.setItem("cookies:notifications:prompt:test-admin", "later");
});
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
      user: { id: "test-admin", username: "test", isAdmin: false },
    };
  if (url.pathname === "/api/mobile/state")
    body = {
      snapshot,
      user: { id: "test-admin", username: "test", isAdmin: false },
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
  if (
    url.pathname === "/api/mobile/command" &&
    route.request().postDataJSON().action === "register"
  ) {
    if (registrationFails) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "تعذر الحفظ الآن" }),
      });
      return;
    }
    body = { message: "تم تسجيل الفصل" };
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});

await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
await page.getByText("من هنا تسجّل أول فصل لك", { exact: true }).waitFor();
assert.equal(
  await page.getByText("دليل الاستخدام", { exact: true }).count(),
  0,
);
assert.equal(
  await page.getByRole("button", { name: "التالي", exact: true }).count(),
  0,
);
// An unrelated tab never receives a tutorial or blocks real navigation.
await page.getByRole("tab", { name: /الأعمال/ }).click();
assert.equal(
  await page.getByText("من هنا تسجّل أول فصل لك", { exact: true }).isVisible(),
  false,
);
await page.getByRole("tab", { name: /الرئيسية/ }).click();
await page
  .getByRole("button", { name: "سجّل فصلًا جديدًا", exact: true })
  .click();
await page.getByText("اضغط واختر العمل الذي أنجزته", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "اختيار العمل أو البحث عنه", exact: true })
  .click();
await page
  .getByRole("button", { name: /Test Novel/ })
  .last()
  .click();
await page
  .getByText("اكتب رقم الفصل الذي أنجزته، ثم اختر تخصصك", { exact: true })
  .waitFor();
await page.getByLabel("رقم الفصل", { exact: true }).fill("12");
await page.getByLabel("رقم الفصل", { exact: true }).blur();
await page
  .getByText("اضغط واختر تخصصك في هذا الفصل", { exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "اختيار التخصص أو البحث عنه", exact: true })
  .click();
await page.getByRole("button", { name: /تحرير/ }).last().click();
await page
  .getByText("راجع اختيارك ثم اضغط لتسجيل الفصل", { exact: true })
  .waitFor();
assert.equal(commands.length, 0);
await page.waitForTimeout(700);
const saveHintBounds = await page
  .getByText("راجع اختيارك ثم اضغط لتسجيل الفصل", { exact: true })
  .boundingBox();
assert.ok(
  saveHintBounds && saveHintBounds.y > 0 && saveHintBounds.y < 950,
  JSON.stringify(saveHintBounds),
);
await page.screenshot({
  path: "/workspace/cookies-artifacts/inline-walkthrough-save.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "تأكيد تسجيل الفصل", exact: true })
  .click();
await page.getByText("تعذر تسجيل الفصل", { exact: true }).waitFor();
await page.getByRole("button", { name: "حسنًا", exact: true }).click();
assert.equal(
  await page
    .getByText("راجع اختيارك ثم اضغط لتسجيل الفصل", { exact: true })
    .isVisible(),
  true,
);
registrationFails = false;
await page
  .getByRole("button", { name: "تأكيد تسجيل الفصل", exact: true })
  .click();
await page.getByText("تم تسجيل الفصول ✦", { exact: true }).waitFor();
await page.getByRole("button", { name: "تم", exact: true }).click();
await page
  .getByText("هنا ملفك الشخصي · اضغط لعرض معلوماتك", { exact: true })
  .waitFor();
assert.equal(commands.length, 2);
assert.equal(commands[1].payload.chapters, "12");
await page.getByRole("button", { name: "ملفي الشخصي", exact: true }).click();
await page.getByText("بطاقة عضو كوكيز", { exact: true }).waitFor();
// Reload resumes at the leaderboard milestone, without replaying registration.
await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("هنا التوب · اضغط الفريق", { exact: true }).waitFor();
await page.screenshot({
  path: "/workspace/cookies-artifacts/inline-walkthrough-leaderboard.png",
  fullPage: true,
});
await page.getByRole("tab", { name: /الفريق/ }).click();
await page.getByText("استكشف التطبيق بنفسك ✦", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "إنهاء الجولة المختصرة", exact: true })
  .click();
await page.goto(base, { waitUntil: "networkidle" });
assert.equal(
  await page.getByText("من هنا تسجّل أول فصل لك", { exact: true }).count(),
  0,
);
assert.equal(
  await page.getByText("هنا التوب · اضغط الفريق", { exact: true }).count(),
  0,
);
assert.equal(
  await page.getByText("استكشف التطبيق بنفسك ✦", { exact: true }).count(),
  0,
);
assert.deepEqual(errors, []);
console.log(
  "Inline member journey: actual work/chapter/specialty/save, failed save retry, own profile, leaderboard, persistence, no guide dialogs passed.",
);
await browser.close();
