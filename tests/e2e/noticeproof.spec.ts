import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Don’t click the recall/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("public landing exposes all three seeded cases", async ({ page }) => {
  await expect(page.getByRole("link", { name: /Open evidence case/i })).toHaveCount(3);
  await expect(page.getByText("Real recall · unsafe channel", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified official channel", { exact: true })).toBeVisible();
  await expect(page.getByText("Blocked conflict", { exact: true })).toBeVisible();
});

test("unsafe-channel hero case preserves verdict across refresh", async ({ page }) => {
  await page.goto("/#/case/real-recall-unsafe-channel");
  await expect(
    page.getByRole("heading", { name: "The recall is real. This notice’s link is not verified." }),
  ).toBeVisible();
  await expect(page.getByText("recall@epoca.com")).toBeVisible();
  await expect(page.getByText("epoca-refund.example", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Real recall · unsafe channel", { exact: true })).toBeVisible();
});

test("official generic email explains its authority and reaches approval preview", async ({
  page,
}) => {
  await page.goto("/#/case/verified-official-channel");
  await expect(page.getByText(/generic Gmail address is trusted/i)).toBeVisible();
  await page.getByRole("button", { name: "Review exact message" }).click();
  await expect(page.getByRole("dialog")).toContainText("shapesorterrecall@gmail.com");
  await expect(page.getByRole("dialog")).toContainText("Not sent in fixture preview");
  await page.getByRole("button", { name: "Approve demo preview" }).click();
  await expect(page.getByText("Demo approval recorded")).toBeVisible();
});

test("keyboard navigation reaches intake and evidence controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop keyboard-order assertion");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "NoticeProof home" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator("a.nav-action")).toBeFocused();
  await page.getByRole("link", { name: "See the 60-second demo" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Review exact message" })).toBeVisible();
});

test("mobile primary flow has no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  await page.goto("/#/case/real-recall-unsafe-channel");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole("button", { name: "Review exact message" })).toBeVisible();
});
