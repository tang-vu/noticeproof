import { v } from "convex/values";
import { claimEnvelopeSchema, type ClaimEnvelope } from "../shared/domain/claimEnvelope";
import { assertTransition } from "../shared/domain/stateMachine";
import { internalMutation, internalQuery } from "./_generated/server";
import { sha256 } from "./lib/access";

export const loadInput = internalQuery({
  args: { caseId: v.id("cases") },
  returns: v.object({ text: v.string(), noticeId: v.id("notices") }),
  handler: async (ctx, args) => {
    const notice = await ctx.db
      .query("notices")
      .withIndex("by_case_id", (q) => q.eq("caseId", args.caseId))
      .first();
    if (!notice?.sanitizedBody) throw new Error("NOTICE_TEXT_NOT_AVAILABLE");
    return { text: notice.sanitizedBody, noticeId: notice._id };
  },
});

function materialClaims(envelope: ClaimEnvelope) {
  const singular = [
    ["manufacturer", envelope.manufacturer],
    ["product_name", envelope.productName],
    ["recall_id", envelope.recallId],
    ["hazard", envelope.hazard],
  ] as const;
  const arrays = [
    ["model", envelope.models],
    ["serial", envelope.serials],
    ["lot", envelope.lots],
    ["upc", envelope.upcs],
    ["url", envelope.urls],
    ["email", envelope.emails],
    ["phone", envelope.phones],
  ] as const;
  return [
    ...singular.flatMap(([claimType, field]) => (field ? [{ claimType, field }] : [])),
    ...arrays.flatMap(([claimType, fields]) => fields.map((field) => ({ claimType, field }))),
  ];
}

export const persistSuccess = internalMutation({
  args: {
    caseId: v.id("cases"),
    noticeId: v.id("notices"),
    envelopeJson: v.string(),
    responseId: v.string(),
    model: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db.get("cases", args.caseId);
    if (!caseDocument || caseDocument.currentState !== "EXTRACTING_CLAIMS") return null;
    const envelope = claimEnvelopeSchema.parse(JSON.parse(args.envelopeJson) as unknown);
    const contentHash = await sha256(args.envelopeJson);
    const now = Date.now();
    const envelopeId = await ctx.db.insert("claimEnvelopes", {
      caseId: caseDocument._id,
      noticeId: args.noticeId,
      schemaVersion: envelope.schemaVersion,
      model: args.model,
      modelResponseId: args.responseId,
      language: envelope.language,
      noticeType: envelope.noticeType,
      ...(envelope.manufacturer ? { manufacturer: envelope.manufacturer.value } : {}),
      ...(envelope.productName ? { productName: envelope.productName.value } : {}),
      ...(envelope.recallId ? { recallId: envelope.recallId.value } : {}),
      ...(envelope.hazard ? { claimedHazard: envelope.hazard.value } : {}),
      ...(envelope.remedy.detail ? { claimedRemedy: envelope.remedy.detail.value } : {}),
      requestedSensitiveKinds: envelope.requestedSensitiveData.map((item) => item.kind),
      validationStatus: "valid",
      contentHash,
      createdAt: now,
    });
    for (const { claimType, field } of materialClaims(envelope)) {
      await ctx.db.insert("claims", {
        caseId: caseDocument._id,
        claimEnvelopeId: envelopeId,
        claimType,
        rawValue: field.span.quote,
        normalizedValue: field.value,
        sourceSpan: field.span,
        confidence: field.confidence,
        matchCritical: ["model", "serial", "lot", "upc", "recall_id"].includes(claimType),
      });
    }
    assertTransition(caseDocument.currentState, "CLAIMS_READY");
    await ctx.db.patch(caseDocument._id, {
      currentState: "CLAIMS_READY",
      nextAction: "Extracted claims are ready for independent evidence acquisition.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "claims.extraction_completed",
      actorType: "system",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: envelope.schemaVersion,
      summary: "OpenAI returned a fully validated ClaimEnvelope.",
      timestamp: now,
      idempotencyKey: `openai:${caseDocument._id}:${contentHash}`,
    });
    return null;
  },
});

export const persistFailure = internalMutation({
  args: { caseId: v.id("cases"), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db.get("cases", args.caseId);
    if (!caseDocument || caseDocument.currentState !== "EXTRACTING_CLAIMS") return null;
    assertTransition(caseDocument.currentState, "VERIFICATION_FAILED_RETRYABLE");
    const now = Date.now();
    await ctx.db.patch(caseDocument._id, {
      currentState: "VERIFICATION_FAILED_RETRYABLE",
      nextAction:
        "Claim extraction could not complete. Retry without treating this as a safety verdict.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "claims.extraction_failed",
      actorType: "system",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: "1",
      summary: "Claim extraction failed safely and can be retried.",
      metadataJson: JSON.stringify({ errorCode: args.errorCode }),
      timestamp: now,
      idempotencyKey: `openai:${caseDocument._id}:failed:${now}`,
    });
    return null;
  },
});
