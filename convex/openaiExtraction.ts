"use node";

import { v } from "convex/values";
import { extractClaimEnvelope } from "../shared/server/openaiExtraction";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const extract = internalAction({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
      const input: { text: string; noticeId: Id<"notices"> } = await ctx.runQuery(
        internal.openaiPersistence.loadInput,
        { caseId: args.caseId },
      );
      const result = await extractClaimEnvelope({
        noticeText: input.text,
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL ?? "gpt-5-mini",
        maxAttempts: 2,
      });
      await ctx.runMutation(internal.openaiPersistence.persistSuccess, {
        caseId: args.caseId,
        noticeId: input.noticeId,
        envelopeJson: JSON.stringify(result.envelope),
        responseId: result.responseId,
        model: result.model,
      });
    } catch (error) {
      await ctx.runMutation(internal.openaiPersistence.persistFailure, {
        caseId: args.caseId,
        errorCode: error instanceof Error ? error.message.slice(0, 120) : "CLAIM_EXTRACTION_FAILED",
      });
    }
    return null;
  },
});
