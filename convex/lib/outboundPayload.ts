import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function purgeOutboundPayload(
  ctx: MutationCtx,
  approvalId: Id<"approvals">,
): Promise<boolean> {
  const payload = await ctx.db
    .query("outboundPayloads")
    .withIndex("by_approval_id", (q) => q.eq("approvalId", approvalId))
    .unique();
  if (!payload) return false;
  await ctx.db.delete("outboundPayloads", payload._id);
  return true;
}
