import { chromium } from "playwright";

const liveUrl = process.argv[2];
if (!liveUrl) {
  throw new Error("Usage: node scripts/liveHeroProof.mjs https://<deployment>.convex.site");
}

const notice = [
  "Recall number: 25-459.",
  "Product: Paris Hilton Mini Beauty Fridge.",
  "Model number: PZB02-E001.",
  "Hazard: fire and burn hazards.",
  "Remedy: refund.",
  "The notice directs consumers to continue at the unverified URL",
  "https://epoca-refund.example/claim.",
  "This is a sanitized NoticeProof live-proof fixture.",
].join(" ");

const terminalStates = new Set([
  "ACTIONABLE",
  "NEEDS IDENTIFIER",
  "BLOCKED CONFLICT",
  "NO AUTHORITATIVE EVIDENCE",
  "VERIFICATION FAILED RETRYABLE",
]);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(liveUrl, { waitUntil: "networkidle" });
  await page.getByLabel("Paste the email or text message").fill(notice);
  await page.getByRole("button", { name: /Verify this notice/ }).click();
  await page.waitForURL(/#\/case\//, { timeout: 15_000 });
  console.log(`CASE_URL=${page.url()}`);

  let lastState = "";
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const state = ((await page.locator(".live-state-row strong").textContent()) ?? "").trim();
    if (state && state !== lastState) {
      console.log(`STATE=${state}`);
      lastState = state;
    }
    if (terminalStates.has(state)) break;
    await page.waitForTimeout(1_500);
  }

  const verdict = ((await page.locator(".live-verdict-panel h2").textContent()) ?? "").trim();
  const claims = await page.locator(".live-claim-list li").count();
  const evidence = (
    (await page
      .getByText(/authoritative sources$/)
      .first()
      .textContent()) ?? ""
  ).trim();
  const safeAction = (
    (await page
      .locator(".live-action-panel h2")
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();

  console.log(`VERDICT=${verdict}`);
  console.log(`CLAIMS=${claims}`);
  console.log(`EVIDENCE=${evidence}`);
  console.log(`SAFE_ACTION=${safeAction}`);

  if (verdict !== "VERIFIED RECALL UNSAFE CHANNEL") {
    throw new Error(`Expected VERIFIED RECALL UNSAFE CHANNEL, received ${verdict || "no verdict"}`);
  }
  if (!safeAction.includes("recall@epoca.com")) {
    throw new Error(
      `Expected independently verified recall@epoca.com action, received ${safeAction}`,
    );
  }
} finally {
  await browser.close();
}
