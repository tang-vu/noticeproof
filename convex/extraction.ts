import { v } from "convex/values";
import { assertTransition } from "../shared/domain/stateMachine";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { requireCaseWriteAccess } from "./lib/access";

export const start = mutation({
  args: { publicId: v.string(), capabilityToken: v.optional(v.string()) },
  returns: v.object({ state: v.literal("EXTRACTING_CLAIMS") }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    if (caseDocument.currentState === "EXTRACTING_CLAIMS") {
      return { state: "EXTRACTING_CLAIMS" as const };
    }
    assertTransition(caseDocument.currentState, "EXTRACTING_CLAIMS");
    const now = Date.now();
    const key = `openai:extract:${caseDocument._id}:${now}`;
    await ctx.db.insert("idempotencyKeys", {
      key,
      operation: "openai.extract.scheduled",
      caseId: caseDocument._id,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.openaiExtraction.extract, {
      caseId: caseDocument._id,
    });
    await ctx.db.patch(caseDocument._id, {
      currentState: "EXTRACTING_CLAIMS",
      nextAction: "Claims are being extracted from untrusted notice text.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "claims.extraction_started",
      actorType: "system",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: "1",
      summary: "Schema-constrained claim extraction started.",
      timestamp: now,
      idempotencyKey: `${key}:timeline`,
    });
    return { state: "EXTRACTING_CLAIMS" as const };
  },
});
