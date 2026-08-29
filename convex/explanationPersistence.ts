import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { recordIntegrationProof } from "./integrationProofs";

export const loadInput = internalQuery({
  args: { caseId: v.id("cases"), verdictId: v.id("verdicts") },
  returns: v.object({
    verdictCode: v.string(),
    verdictVersion: v.number(),
    ruleResults: v.array(v.object({ ruleId: v.string(), outcome: v.string() })),
  }),
  handler: async (ctx, args) => {
    const verdict = await ctx.db.get("verdicts", args.verdictId);
    if (!verdict || verdict.caseId !== args.caseId) throw new Error("VERDICT_NOT_FOUND");
    const ruleResults = verdict.ruleResults.map((rule) => ({
      ruleId: rule.ruleId,
      outcome: rule.outcome,
    }));
    return {
      verdictCode: verdict.code,
      verdictVersion: verdict.version,
      ruleResults,
    };
  },
});

export const persist = internalMutation({
  args: {
    caseId: v.id("cases"),
    verdictId: v.id("verdicts"),
    verdictVersion: v.number(),
    model: v.string(),
    modelResponseId: v.string(),
    templateIds: v.array(v.string()),
    referencedRuleIds: v.array(v.string()),
    text: v.string(),
    inputHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const verdict = await ctx.db.get("verdicts", args.verdictId);
    if (!verdict || verdict.caseId !== args.caseId || verdict.version !== args.verdictVersion) {
      return null;
    }
    const existing = await ctx.db
      .query("verdictExplanations")
      .withIndex("by_verdict_id", (q) => q.eq("verdictId", args.verdictId))
      .unique();
    if (existing) return null;
    const now = Date.now();
    await ctx.db.insert("verdictExplanations", {
      caseId: args.caseId,
      verdictId: args.verdictId,
      verdictVersion: args.verdictVersion,
      model: args.model,
      modelResponseId: args.modelResponseId,
      templateIds: args.templateIds,
      referencedRuleIds: args.referencedRuleIds,
      text: args.text,
      inputHash: args.inputHash,
      createdAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: args.caseId,
      eventType: "verdict.explanation_created",
      actorType: "system",
      visibility: "private",
      payloadVersion: "1",
      summary: "OpenAI selected a bounded explanation grounded in stored rule results.",
      timestamp: now,
      idempotencyKey: `verdict-explanation:${args.verdictId}:${args.inputHash}`,
    });
    await recordIntegrationProof(ctx, {
      proofKey: "openai.bounded_explanation",
      sponsor: "OpenAI",
      milestone: "Rule-grounded explanation created",
      detail:
        "The model selected allowlisted templates and existing rule IDs; TypeScript rendered the text.",
      status: "verified",
      verifiedAt: now,
    });
    return null;
  },
});
