import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

type Sponsor = "Convex" | "OpenAI" | "Firecrawl" | "AgentMail";
type ProofStatus = "verified" | "active" | "retryable";

export async function recordIntegrationProof(
  ctx: MutationCtx,
  proof: {
    proofKey: string;
    sponsor: Sponsor;
    milestone: string;
    detail: string;
    status: ProofStatus;
    verifiedAt: number;
  },
) {
  const existing = await ctx.db
    .query("integrationProofs")
    .withIndex("by_proof_key", (q) => q.eq("proofKey", proof.proofKey))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, proof);
  } else {
    await ctx.db.insert("integrationProofs", proof);
  }
}

export const listPublic = query({
  args: {},
  returns: v.array(schema.doc("integrationProofs")),
  handler: async (ctx) =>
    await ctx.db.query("integrationProofs").withIndex("by_verified_at").order("desc").take(8),
});

export const backfillFromRecentActivity = internalMutation({
  args: {},
  returns: v.object({ recorded: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let recorded = 0;
    const inbound = await ctx.db
      .query("notices")
      .withIndex("by_agentmail_inbound_id", (q) => q.gt("agentmailInboundId", ""))
      .first();
    if (inbound) {
      await recordIntegrationProof(ctx, {
        proofKey: "agentmail.inbound",
        sponsor: "AgentMail",
        milestone: "Signed inbound received",
        detail: "A verified webhook created or attached a private case idempotently.",
        status: "verified",
        verifiedAt: now,
      });
      recorded += 1;
    }
    const envelope = await ctx.db
      .query("claimEnvelopes")
      .withIndex("by_validation_status", (q) => q.eq("validationStatus", "valid"))
      .first();
    if (envelope) {
      await recordIntegrationProof(ctx, {
        proofKey: "openai.structured_extraction",
        sponsor: "OpenAI",
        milestone: "Structured extraction validated",
        detail: "A Responses API result passed the versioned ClaimEnvelope schema.",
        status: "verified",
        verifiedAt: now,
      });
      recorded += 1;
    }
    const source = await ctx.db
      .query("sources")
      .withIndex("by_status_and_content_hash", (q) =>
        q.eq("status", "complete").gt("contentHash", ""),
      )
      .first();
    if (source) {
      await recordIntegrationProof(ctx, {
        proofKey: "firecrawl.authority_evidence",
        sponsor: "Firecrawl",
        milestone: "Authority evidence acquired",
        detail: "An official source was fetched, normalized, and content-hashed.",
        status: "verified",
        verifiedAt: now,
      });
      recorded += 1;
    }
    const deliveries = await ctx.db
      .query("communications")
      .withIndex("by_delivery_state", (q) => q.eq("deliveryState", "delivered"))
      .take(10);
    if (deliveries.length) {
      await recordIntegrationProof(ctx, {
        proofKey: "agentmail.delivery",
        sponsor: "AgentMail",
        milestone: "Controlled delivery confirmed",
        detail: "A human-approved verified-channel message reached delivered state.",
        status: "verified",
        verifiedAt: now,
      });
      recorded += 1;
    }
    return { recorded };
  },
});
