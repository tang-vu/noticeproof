import { RECEIPT_VERSION } from "../../shared/domain/constants";
import { canonicalJson, hashCanonical } from "../../shared/domain/hashing";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type ReceiptStage = "verdict_created" | "approval_consumed" | "remedy_confirmed" | "case_resolved";

export async function appendEvidenceReceipt(
  ctx: MutationCtx,
  caseId: Id<"cases">,
  stage: ReceiptStage,
  now: number,
) {
  const caseDocument = await ctx.db.get("cases", caseId);
  if (!caseDocument) throw new Error("RECEIPT_CASE_MISSING");
  const [notice, verdict, sources, timeline, approvals] = await Promise.all([
    ctx.db
      .query("notices")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .first(),
    ctx.db
      .query("verdicts")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .order("desc")
      .first(),
    ctx.db
      .query("sources")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .take(50),
    ctx.db
      .query("timelineEvents")
      .withIndex("by_case_and_timestamp", (q) => q.eq("caseId", caseId))
      .take(100),
    ctx.db
      .query("approvals")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .order("desc")
      .take(20),
  ]);
  if (!notice || !verdict) throw new Error("RECEIPT_INPUT_MISSING");

  const consumedApproval =
    stage === "verdict_created"
      ? undefined
      : approvals.find((approval) => approval.state === "consumed");
  if (stage === "approval_consumed" && !consumedApproval) {
    throw new Error("RECEIPT_APPROVAL_MISSING");
  }
  const approvalHash = consumedApproval
    ? await hashCanonical({
        actionType: consumedApproval.actionType,
        payloadHash: consumedApproval.payloadHash,
        verdictVersion: consumedApproval.verdictVersion,
        evidenceManifestHash: consumedApproval.evidenceManifestHash,
        state: consumedApproval.state,
        approvedAt: consumedApproval.approvedAt,
        consumedAt: consumedApproval.consumedAt,
      })
    : undefined;
  const verdictHash = await hashCanonical({
    version: verdict.version,
    code: verdict.code,
    ruleEngineVersion: verdict.ruleEngineVersion,
    summary: verdict.summary,
    missingIdentifiers: verdict.missingIdentifiers,
    eligibleActions: verdict.eligibleActions,
    blockingReasons: verdict.blockingReasons,
    claimEnvelopeHash: verdict.claimEnvelopeHash,
    evidenceManifestHash: verdict.evidenceManifestHash,
    ruleResults: verdict.ruleResults,
    createdAt: verdict.createdAt,
  });
  const timelineHash = await hashCanonical(
    timeline
      .map(({ eventType, payloadVersion, summary, timestamp }) => ({
        eventType,
        payloadVersion,
        summary,
        timestamp,
      }))
      .sort((a, b) => a.timestamp - b.timestamp),
  );
  const evidence = sources
    .map((source) => ({
      authorityTier: source.authorityTier,
      canonicalDomain: source.canonicalDomain,
      canonicalUrl: source.canonicalUrl,
      contentHash: source.contentHash,
      fetchedAt: source.fetchedAt,
      sourceType: source.sourceType,
      verifiesContact: source.verifiesContact,
    }))
    .sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl));
  const machineJson = canonicalJson({
    receiptVersion: RECEIPT_VERSION,
    stage,
    generatedFrom: caseDocument.isPublicFixture ? "sanitized_fixture" : "live_case",
    publicCaseId: caseDocument.publicId,
    verdictVersion: verdict.version,
    createdAt: now,
    hashes: {
      notice: notice.canonicalNoticeHash,
      claimEnvelope: verdict.claimEnvelopeHash,
      verdict: verdictHash,
      evidenceManifest: verdict.evidenceManifestHash,
      timeline: timelineHash,
      ...(approvalHash ? { approval: approvalHash } : {}),
    },
    verdict: {
      code: verdict.code,
      ruleEngineVersion: verdict.ruleEngineVersion,
      ruleResults: verdict.ruleResults,
      missingIdentifiers: verdict.missingIdentifiers,
      eligibleActions: verdict.eligibleActions,
      blockingReasons: verdict.blockingReasons,
    },
    evidence,
  });

  return await ctx.db.insert("evidenceReceipts", {
    caseId,
    receiptVersion: RECEIPT_VERSION,
    noticeHash: notice.canonicalNoticeHash,
    claimEnvelopeHash: verdict.claimEnvelopeHash,
    verdictHash,
    evidenceManifestHash: verdict.evidenceManifestHash,
    ...(approvalHash ? { approvalHash } : {}),
    timelineHash,
    humanSummary: `Verdict v${verdict.version}: ${verdict.code}. Receipt stage: ${stage}.`,
    machineJson,
    createdAt: now,
  });
}
