import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
for (const viewport of [
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const errors = [],
    commands = [];
  let fail = false;
  page.on("pageerror", (e) => errors.push(e.message));
  const snapshot = {
    version: 1,
    records: [
      {
        id: "record-1",
        userId: "test-admin",
        username: "test",
        work_name: "Team Novel",
        chapter: "1",
        work_type: "تحرير",
        total: 0.25,
        notes: "",
        timestamp: "2026-10-13T10:00:00Z",
        month_key: "2026-10",
      },
    ],
    works: [{ name: "Team Novel", active: true }],
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
  await page.addInitScript(() =>
    sessionStorage.setItem("cookies.token", "browser-test"),
  );
  await page.route("https://cookies-app-work.vercel.app/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {},
      status = 200;
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
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (fail) {
        status = 503;
        body = { error: "اختبار انقطاع الاتصال" };
        fail = false;
      } else {
        if (command.action === "editWork")
          snapshot.works[0].name = command.payload.newName;
        if (command.action === "deleteWork") snapshot.works = [];
        body = { message: "تمت العملية بنجاح" };
      }
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://localhost:8081", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.getByText("مساحتي", { exact: true }).click();
  await page
    .getByRole("button", { name: "لوحة الإشراف الكاملة", exact: true })
    .click();
  await page.getByRole("button", { name: "سجلات الفصول", exact: true }).click();
  await page.getByText("تعديل هذا السجل", { exact: true }).click();
  await page
    .getByLabel("ملاحظات السجل", { exact: true })
    .fill("اختبار النافذة");
  fail = true;
  await page
    .getByRole("button", { name: "حفظ هذا السجل", exact: true })
    .click();
  await page.getByText("اختبار انقطاع الاتصال", { exact: true }).waitFor();
  await page.getByRole("button", { name: "حسنًا", exact: true }).click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.getByText("تعديل هذا السجل", { exact: true }).click();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("مساحتي", { exact: true }).click();
  await page
    .getByRole("button", { name: "لوحة الإشراف الكاملة", exact: true })
    .click();
  await page.getByRole("button", { name: "الأعمال", exact: true }).click();
  await page.getByText("إدارة العمل", { exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: "حذف العمل من القائمة", exact: true })
      .click();
    await page.getByText("تأكيد العملية", { exact: true }).waitFor();
    await page.getByRole("button", { name: "إلغاء", exact: true }).click();
    await page
      .getByText("تأكيد العملية", { exact: true })
      .waitFor({ state: "hidden" });
  }
  assert.equal(commands.filter((c) => c.action === "deleteWork").length, 0);
  await page.getByLabel("اسم العمل", { exact: true }).fill("Renamed Novel");
  fail = true;
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page.getByText("اختبار انقطاع الاتصال", { exact: true }).waitFor();
  await page.getByRole("button", { name: "حسنًا", exact: true }).click();
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await page.getByText("تمت العملية بنجاح", { exact: true }).waitFor();
  await page.getByRole("button", { name: "تم", exact: true }).click();
  await page.getByText("Renamed Novel", { exact: true }).waitFor();
  await page.getByText("إدارة العمل", { exact: true }).click();
  await page
    .getByRole("button", { name: "حذف العمل من القائمة", exact: true })
    .click();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await page.getByText("تمت العملية بنجاح", { exact: true }).waitFor();
  await page.getByRole("button", { name: "تم", exact: true }).click();
  await page
    .getByRole("button", { name: "إضافة عمل جديد", exact: true })
    .click();
  await page.getByText("عمل جديد", { exact: true }).waitFor();
  assert.equal(commands.filter((c) => c.action === "deleteWork").length, 1);
  assert.deepEqual(errors, []);
  console.log(
    `Dialogs ${viewport.width}px: repeated cancel, failure/retry, rename, confirmed delete and next navigation passed.`,
  );
  await page.close();
}
await browser.close();
