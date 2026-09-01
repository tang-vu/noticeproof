import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const liveUrl = process.argv[2] ?? "https://lovely-eel-809.convex.site";
const outputDir = resolve(process.argv[3] ?? "demo-output");
const totalMs = Number(process.env.NOTICEPROOF_DEMO_DURATION_MS ?? 165_000);
if (!Number.isFinite(totalMs) || totalMs < 90_000 || totalMs > 178_000) {
  throw new Error("NOTICEPROOF_DEMO_DURATION_MS must be between 90000 and 178000");
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  recordVideo: { dir: outputDir, size: { width: 1440, height: 810 } },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

const startedAt = Date.now();
const at = async (fraction) => {
  const remaining = Math.round(totalMs * fraction - (Date.now() - startedAt));
  if (remaining > 0) await page.waitForTimeout(remaining);
};
const show = async (selector) => {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
};

await page.goto(liveUrl, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Don.t click the recall/i }).waitFor();
await at(0.07);
await show(".deployment-proof");
await at(0.14);
await show(".intake-section");
await at(0.2);
await show(".demo-section");
await page
  .getByRole("link", { name: /Open evidence case/i })
  .first()
  .click();
await page.getByRole("heading", { name: /The recall is real/i }).waitFor();
await at(0.28);
await show(".notice-panel");
await at(0.36);
await show(".ledger");
await at(0.46);
await show(".evidence-list");
await at(0.56);
await show(".why-panel");
await at(0.64);
await show(".next-panel");
await page.getByRole("button", { name: "Review exact message" }).click();
await page.getByRole("dialog").waitFor();
await at(0.72);
await page.getByRole("button", { name: "Approve demo preview" }).click();
await show(".timeline-panel");
await at(0.79);
await show(".receipt-card");
await at(0.83);
await page.goto(`${liveUrl}/#/case/verified-official-channel`, { waitUntil: "networkidle" });
await page.getByText(/generic Gmail address is trusted/i).waitFor();
await show(".trust-note");
await at(0.9);
await show(".next-panel");
await page.getByRole("button", { name: "Review exact message" }).click();
await at(0.95);
await page.getByRole("button", { name: "Close" }).click();
await page.goto(liveUrl, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Don.t click the recall/i }).waitFor();
await page.evaluate(() => globalThis.scrollTo({ top: 0, behavior: "smooth" }));
await at(1);

const video = page.video();
await context.close();
await browser.close();
if (!video) throw new Error("Playwright did not create a video");
await copyFile(await video.path(), resolve(outputDir, "noticeproof-raw.webm"));
if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(" | ")}`);
console.log(`RAW_VIDEO=${resolve(outputDir, "noticeproof-raw.webm")}`);
console.log(`DURATION_TARGET_MS=${totalMs}`);
