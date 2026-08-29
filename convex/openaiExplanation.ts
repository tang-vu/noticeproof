"use node";

import { v } from "convex/values";
import { generateBoundedExplanation } from "../shared/server/openaiExplanation";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { sha256 } from "./lib/access";

export const generate = internalAction({
  args: { caseId: v.id("cases"), verdictId: v.id("verdicts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!env.OPENAI_API_KEY) return null;
    try {
      const input = await ctx.runQuery(internal.explanationPersistence.loadInput, args);
      const inputHash = await sha256(
        JSON.stringify({ code: input.verdictCode, ruleResults: input.ruleResults }),
      );
      const model = env.OPENAI_MODEL ?? "gpt-5-mini";
      const result = await generateBoundedExplanation({
        verdictCode: input.verdictCode,
        ruleResults: input.ruleResults,
        apiKey: env.OPENAI_API_KEY,
        model,
      });
      await ctx.runMutation(internal.explanationPersistence.persist, {
        ...args,
        verdictVersion: input.verdictVersion,
        model,
        modelResponseId: result.responseId,
        templateIds: result.templateIds,
        referencedRuleIds: result.referencedRuleIds,
        text: result.text,
        inputHash,
      });
    } catch {
      // Explanation is non-authoritative and optional; the deterministic verdict remains complete.
    }
    return null;
  },
});
