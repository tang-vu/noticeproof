import { chromium } from "playwright";

const liveUrl = process.argv[2];
const shouldSend = process.argv.includes("--send");
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
  `Fixture nonce: np-live-${Date.now()}.`,
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
  try {
    await page.waitForURL(/#\/case\//, { timeout: 30_000 });
  } catch (error) {
    const intakeStatus = ((await page.locator(".form-status").first().textContent()) ?? "").trim();
    throw new Error(`Intake did not create a case: ${intakeStatus || "no UI error"}`, {
      cause: error,
    });
  }
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
  const receipt = (
    (await page
      .locator(".live-receipt-panel h2")
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();

  console.log(`VERDICT=${verdict}`);
  console.log(`CLAIMS=${claims}`);
  console.log(`EVIDENCE=${evidence}`);
  console.log(`SAFE_ACTION=${safeAction}`);
  console.log(`RECEIPT=${receipt}`);

  if (verdict !== "VERIFIED RECALL UNSAFE CHANNEL") {
    throw new Error(`Expected VERIFIED RECALL UNSAFE CHANNEL, received ${verdict || "no verdict"}`);
  }
  if (!safeAction.includes("recall@epoca.com")) {
    throw new Error(
      `Expected independently verified recall@epoca.com action, received ${safeAction}`,
    );
  }
  if (receipt !== "Reproduce what NoticeProof knew") {
    throw new Error(`Expected a live append-only evidence receipt, received ${receipt || "none"}`);
  }

  if (shouldSend) {
    await page.getByRole("button", { name: "Review exact payload" }).click();
    const demoRouting = page.locator(".demo-routing-note");
    await demoRouting.waitFor({ state: "visible", timeout: 10_000 });
    const demoText = ((await demoRouting.textContent()) ?? "").trim();
    if (!demoText.startsWith("Demo mode routes delivery to")) {
      throw new Error("Controlled demo routing is not explicitly labeled.");
    }
    await page.getByRole("button", { name: "Approve exact payload" }).click();
    await page.getByText("AgentMail delivery · realtime").waitFor({
      state: "visible",
      timeout: 15_000,
    });
    const deliveryHeading = page.locator(".live-delivery-panel h2");
    let delivery = "";
    let previousDelivery = "";
    const deliveryDeadline = Date.now() + 90_000;
    while (Date.now() < deliveryDeadline) {
      delivery = ((await deliveryHeading.textContent()) ?? "").trim();
      if (delivery && delivery !== previousDelivery) {
        console.log(`AGENTMAIL_STATUS=${delivery}`);
        previousDelivery = delivery;
      }
      if (["SENT", "DELIVERED"].includes(delivery)) break;
      if (["FAILED", "BOUNCED", "REJECTED"].includes(delivery)) {
        throw new Error(`AgentMail terminated with ${delivery}`);
      }
      await page.waitForTimeout(1_000);
    }
    if (!["SENT", "DELIVERED"].includes(delivery)) {
      throw new Error(`AgentMail did not leave ${delivery || "unknown"} within 90 seconds`);
    }
    console.log("DEMO_DESTINATION=controlled_and_redacted");
  }
} finally {
  await browser.close();
}
