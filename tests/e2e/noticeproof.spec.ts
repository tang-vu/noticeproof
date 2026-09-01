import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

test("tracked forwarding keeps the capability in-browser and opens live instructions", async ({
  page,
}) => {
  const trackedForwardButton = page.getByRole("button", { name: "Start a tracked forward" });
  test.skip(
    await trackedForwardButton.isDisabled(),
    "requires configured Convex and AgentMail browser environment",
  );
  await trackedForwardButton.click();
  await expect(
    page.getByRole("heading", { name: /Forward the notice, then watch this case update live/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\[NP-[A-F0-9]{24}\]/)).toBeVisible();
  await expect(page.getByText(/code expires in 24 hours/i)).toBeVisible();
  expect(await page.evaluate(() => location.hash.startsWith("#/case/np_mail_"))).toBe(true);
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

test("landing has no automatically detectable serious WCAG violations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "single-browser accessibility audit");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("hero evidence case has no automatically detectable serious WCAG violations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "single-browser accessibility audit");
  await page.goto("/#/case/real-recall-unsafe-channel");
  await expect(page.getByRole("heading", { name: /recall is real/i })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
