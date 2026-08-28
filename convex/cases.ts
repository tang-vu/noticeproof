import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createCapabilityToken, requireCaseAccess, sha256 } from "./lib/access";
import schema from "./schema";
import { sanitizePlainText } from "../shared/domain/redaction";

const MAX_NOTICE_LENGTH = 40_000;

export const createPasted = mutation({
  args: {
    subject: v.string(),
    sender: v.string(),
    body: v.string(),
  },
  returns: v.object({ publicId: v.string(), capabilityToken: v.string() }),
  handler: async (ctx, args) => {
    if (!args.body.trim() || args.body.length > MAX_NOTICE_LENGTH) {
      throw new Error("NOTICE_LENGTH_INVALID");
    }
    if (args.subject.length > 300 || args.sender.length > 300) {
      throw new Error("NOTICE_METADATA_INVALID");
    }

    const now = Date.now();
    const windowStart = Math.floor(now / 60_000) * 60_000;
    const rateLimit = await ctx.db
      .query("rateLimits")
      .withIndex("by_scope_action_window", (q) =>
        q
          .eq("scopeHash", "public-intake")
          .eq("action", "createPasted")
          .eq("windowStart", windowStart),
      )
      .unique();
    if (rateLimit && rateLimit.count >= 30) throw new Error("RATE_LIMITED");
    if (rateLimit) {
      await ctx.db.patch(rateLimit._id, { count: rateLimit.count + 1, updatedAt: now });
    } else {
      await ctx.db.insert("rateLimits", {
        scopeHash: "public-intake",
        action: "createPasted",
        windowStart,
        count: 1,
        updatedAt: now,
      });
    }
    const capabilityToken = createCapabilityToken();
    const publicId = `np_${crypto.randomUUID().replaceAll("-", "")}`;
    const sanitizedBody = sanitizePlainText(args.body, MAX_NOTICE_LENGTH);
    const bodyPreview = sanitizedBody.slice(0, 500);
    const canonicalNoticeHash = await sha256(`${args.subject}\n${args.sender}\n${args.body}`);
    const existing = await ctx.db
      .query("notices")
      .withIndex("by_notice_hash", (q) => q.eq("canonicalNoticeHash", canonicalNoticeHash))
      .first();
    if (existing) throw new Error("DUPLICATE_NOTICE");

    const caseId = await ctx.db.insert("cases", {
      publicId,
      capabilityHash: await sha256(capabilityToken),
      inputKind: "pasted_text",
      currentState: "RECEIVED",
      riskLevel: "unknown",
      nextAction: "Notice received. Claim extraction has not started yet.",
      currentVerdictVersion: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      isDemo: false,
      isPublicFixture: false,
      rawRetentionUntil: now + 7 * 24 * 60 * 60 * 1000,
    });
    await ctx.db.insert("notices", {
      caseId,
      subject: args.subject.slice(0, 300),
      sender: args.sender.slice(0, 300),
      bodyPreview,
      sanitizedBody,
      attachmentMetadata: [],
      canonicalNoticeHash,
      createdAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId,
      eventType: "notice.received",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary: "A pasted notice was received for verification.",
      timestamp: now,
      idempotencyKey: `notice:${canonicalNoticeHash}`,
    });
    return { publicId, capabilityToken };
  },
});

export const get = query({
  args: { publicId: v.string(), capabilityToken: v.optional(v.string()) },
  returns: v.object({
    case: schema.doc("cases"),
    notices: v.array(schema.doc("notices")),
    sources: v.array(schema.doc("sources")),
    verdicts: v.array(schema.doc("verdicts")),
    approvals: v.array(schema.doc("approvals")),
    communications: v.array(schema.doc("communications")),
    timeline: v.array(schema.doc("timelineEvents")),
  }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseAccess(ctx, args.publicId, args.capabilityToken);
    const [notices, sources, verdicts, approvals, communications, timeline] = await Promise.all([
      ctx.db
        .query("notices")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(10),
      ctx.db
        .query("sources")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(50),
      ctx.db
        .query("verdicts")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("approvals")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("communications")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(50),
      ctx.db
        .query("timelineEvents")
        .withIndex("by_case_and_timestamp", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(100),
    ]);
    return { case: caseDocument, notices, sources, verdicts, approvals, communications, timeline };
  },
});

export const listPublicDemos = query({
  args: {},
  returns: v.array(schema.doc("cases")),
  handler: async (ctx) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_public_fixture", (q) => q.eq("isPublicFixture", true))
      .take(10);
  },
});
