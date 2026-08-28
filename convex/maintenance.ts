import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const expireApprovalsAndRawContent = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ approvalsExpired: v.number(), rawCasesPurged: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_state_and_expires_at", (q) => q.eq("state", "pending").lt("expiresAt", now))
      .take(100);
    for (const approval of approvals) await ctx.db.patch(approval._id, { state: "expired" });

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_raw_retention", (q) => q.lt("rawRetentionUntil", now))
      .take(25);
    for (const caseDocument of cases) {
      const notices = await ctx.db
        .query("notices")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(10);
      for (const notice of notices) {
        if (notice.rawStorageId) await ctx.storage.delete(notice.rawStorageId);
        if (notice.sanitizedBody) {
          await ctx.db.patch(notice._id, { sanitizedBody: "[expired by retention policy]" });
        }
      }
      await ctx.db.patch(caseDocument._id, {
        rawContentPurgedAt: now,
        rawRetentionUntil: now + 10 * 365 * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
    }
    return { approvalsExpired: approvals.length, rawCasesPurged: cases.length };
  },
});
