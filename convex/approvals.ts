import { AgentMail, type OutboundId } from "@agentmail/convex";
import { v } from "convex/values";
import { assertTransition } from "../shared/domain/stateMachine";
import {
  hasSensitiveRequest,
  redactSensitiveText,
  sanitizePlainText,
} from "../shared/domain/redaction";
import { components, internal } from "./_generated/api";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireCaseAccess, requireCaseWriteAccess, sha256 } from "./lib/access";

const agentmail = new AgentMail(components.agentmail);
const ACTIONABLE_VERDICTS = new Set([
  "VERIFIED_OFFICIAL_CHANNEL",
  "VERIFIED_RECALL_UNSAFE_CHANNEL",
]);

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.includes("\r") || email.includes("\n") || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("RECIPIENT_INVALID");
  }
  return email;
}

export const createDraft = mutation({
  args: {
    publicId: v.string(),
    capabilityToken: v.optional(v.string()),
    verifiedRecipientSourceId: v.id("sources"),
    intendedRecipient: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.object({
    approvalId: v.id("approvals"),
    intendedRecipient: v.string(),
    actualRecipient: v.string(),
    redactedPreview: v.string(),
    payloadHash: v.string(),
    expiresAt: v.number(),
    demoRedirected: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    if (caseDocument.currentState !== "ACTIONABLE") throw new Error("CASE_NOT_ACTIONABLE");
    if (
      !caseDocument.currentVerdictCode ||
      !ACTIONABLE_VERDICTS.has(caseDocument.currentVerdictCode)
    ) {
      throw new Error("VERDICT_NOT_ACTIONABLE");
    }
    if (args.subject.length < 1 || args.subject.length > 200 || /[\r\n]/.test(args.subject)) {
      throw new Error("SUBJECT_INVALID");
    }
    if (args.body.length < 1 || args.body.length > 10_000 || hasSensitiveRequest(args.body)) {
      throw new Error("PAYLOAD_BLOCKED");
    }

    const source = await ctx.db.get("sources", args.verifiedRecipientSourceId);
    if (
      !source ||
      source.caseId !== caseDocument._id ||
      source.authorityTier > 2 ||
      !source.verifiesContact ||
      !source.verifiedEmail
    ) {
      throw new Error("RECIPIENT_NOT_VERIFIED");
    }
    const intendedRecipient = normalizeEmail(args.intendedRecipient);
    if (intendedRecipient !== normalizeEmail(source.verifiedEmail)) {
      throw new Error("RECIPIENT_SOURCE_MISMATCH");
    }

    const verdict = await ctx.db
      .query("verdicts")
      .withIndex("by_case_and_version", (q) =>
        q.eq("caseId", caseDocument._id).eq("version", caseDocument.currentVerdictVersion),
      )
      .unique();
    if (!verdict) throw new Error("CURRENT_VERDICT_MISSING");

    const demoMode = env.DEMO_MODE === "true";
    if (demoMode && !env.DEMO_VENDOR_EMAIL) throw new Error("DEMO_RECIPIENT_NOT_CONFIGURED");
    const actualRecipient = demoMode
      ? normalizeEmail(env.DEMO_VENDOR_EMAIL as string)
      : intendedRecipient;
    const sanitizedSubject = sanitizePlainText(args.subject, 200);
    const sanitizedBody = sanitizePlainText(args.body, 10_000);
    const payloadHash = await sha256(
      JSON.stringify({
        actualRecipient,
        intendedRecipient,
        subject: sanitizedSubject,
        body: sanitizedBody,
      }),
    );
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;
    assertTransition(caseDocument.currentState, "AWAITING_APPROVAL");

    const pending = await ctx.db
      .query("approvals")
      .withIndex("by_case_and_state", (q) =>
        q.eq("caseId", caseDocument._id).eq("state", "pending"),
      )
      .take(20);
    for (const approval of pending) await ctx.db.patch(approval._id, { state: "expired" });

    const redactedPreview = redactSensitiveText(`${sanitizedSubject}\n\n${sanitizedBody}`).slice(
      0,
      2_000,
    );
    const approvalId = await ctx.db.insert("approvals", {
      caseId: caseDocument._id,
      actionType: "contact_verified_email",
      intendedRecipient,
      actualRecipient,
      verifiedRecipientSourceId: source._id,
      redactedPreview,
      payloadHash,
      verdictVersion: verdict.version,
      evidenceManifestHash: verdict.evidenceManifestHash,
      state: "pending",
      expiresAt,
      createdAt: now,
    });
    await ctx.db.insert("outboundPayloads", {
      caseId: caseDocument._id,
      approvalId,
      intendedRecipient,
      actualRecipient,
      subject: sanitizedSubject,
      body: sanitizedBody,
      payloadHash,
      createdAt: now,
    });
    await ctx.db.patch(caseDocument._id, { currentState: "AWAITING_APPROVAL", updatedAt: now });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "approval.requested",
      actorType: "consumer",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: "1",
      summary: demoMode
        ? "A demo-rerouted message is awaiting exact payload approval."
        : "A message to an independently verified recipient is awaiting approval.",
      timestamp: now,
      idempotencyKey: `approval:${approvalId}:requested`,
    });
    return {
      approvalId,
      intendedRecipient,
      actualRecipient,
      redactedPreview,
      payloadHash,
      expiresAt,
      demoRedirected: demoMode,
    };
  },
});

export const approveAndSend = mutation({
  args: {
    publicId: v.string(),
    capabilityToken: v.optional(v.string()),
    approvalId: v.id("approvals"),
    payloadHash: v.string(),
  },
  returns: v.object({ outboundId: v.string(), state: v.literal("AWAITING_REPLY") }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    const approval = await ctx.db.get("approvals", args.approvalId);
    if (!approval || approval.caseId !== caseDocument._id) throw new Error("APPROVAL_NOT_FOUND");
    if (approval.state !== "pending") throw new Error("APPROVAL_NOT_PENDING");
    if (approval.expiresAt <= Date.now()) {
      await ctx.db.patch(approval._id, { state: "expired" });
      throw new Error("APPROVAL_EXPIRED");
    }
    if (approval.payloadHash !== args.payloadHash) throw new Error("PAYLOAD_HASH_MISMATCH");
    if (
      approval.verdictVersion !== caseDocument.currentVerdictVersion ||
      caseDocument.currentState !== "AWAITING_APPROVAL"
    ) {
      throw new Error("APPROVAL_STALE");
    }
    const verdict = await ctx.db
      .query("verdicts")
      .withIndex("by_case_and_version", (q) =>
        q.eq("caseId", caseDocument._id).eq("version", approval.verdictVersion),
      )
      .unique();
    if (!verdict || verdict.evidenceManifestHash !== approval.evidenceManifestHash) {
      throw new Error("EVIDENCE_CHANGED");
    }
    const source = await ctx.db.get("sources", approval.verifiedRecipientSourceId);
    if (!source || !source.verifiesContact || source.authorityTier > 2) {
      throw new Error("VERIFIED_RECIPIENT_REVOKED");
    }
    const payload = await ctx.db
      .query("outboundPayloads")
      .withIndex("by_approval_id", (q) => q.eq("approvalId", approval._id))
      .unique();
    if (!payload || payload.payloadHash !== approval.payloadHash)
      throw new Error("PAYLOAD_MISSING");
    if (!env.AGENTMAIL_INBOX_ID) throw new Error("AGENTMAIL_INBOX_ID_NOT_CONFIGURED");

    assertTransition(caseDocument.currentState, "CONTACTING_VERIFIED_CHANNEL");
    assertTransition("CONTACTING_VERIFIED_CHANNEL", "AWAITING_REPLY");
    const outboundId = await agentmail.sendMessage(ctx, env.AGENTMAIL_INBOX_ID, {
      to: payload.actualRecipient,
      subject: payload.subject,
      text: payload.body,
      labels: ["noticeproof", `case-${caseDocument.publicId}`],
    });
    const now = Date.now();
    await ctx.db.patch(approval._id, { state: "consumed", approvedAt: now, consumedAt: now });
    await ctx.db.patch(caseDocument._id, { currentState: "AWAITING_REPLY", updatedAt: now });
    await ctx.db.insert("communications", {
      caseId: caseDocument._id,
      outboundId,
      direction: "outbound",
      intendedRecipient: payload.intendedRecipient,
      actualRecipient: payload.actualRecipient,
      verifiedRecipientSourceId: approval.verifiedRecipientSourceId,
      deliveryState: "queued",
      redactedSummary: approval.redactedPreview,
      attachmentMetadata: [],
      createdAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "agentmail.send_queued",
      actorType: "agentmail",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: "1",
      summary: "AgentMail durably queued a new thread to the verified channel.",
      timestamp: now,
      idempotencyKey: `agentmail:${outboundId}:queued`,
    });
    await ctx.scheduler.runAfter(1_000, internal.approvals.syncOutboundStatus, {
      caseId: caseDocument._id,
      outboundId,
    });
    return { outboundId, state: "AWAITING_REPLY" as const };
  },
});

export const listOutboundSyncCandidates = internalQuery({
  args: {},
  returns: v.array(v.object({ caseId: v.id("cases"), outboundId: v.string() })),
  handler: async (ctx) => {
    const [queued, sent] = await Promise.all([
      ctx.db
        .query("communications")
        .withIndex("by_delivery_state", (q) => q.eq("deliveryState", "queued"))
        .take(20),
      ctx.db
        .query("communications")
        .withIndex("by_delivery_state", (q) => q.eq("deliveryState", "sent"))
        .take(20),
    ]);
    return [...queued, ...sent].flatMap((communication) =>
      communication.outboundId
        ? [{ caseId: communication.caseId, outboundId: communication.outboundId }]
        : [],
    );
  },
});

export const persistOutboundStatus = internalMutation({
  args: {
    caseId: v.id("cases"),
    outboundId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("rejected"),
      v.literal("failed"),
    ),
    agentmailMessageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const communication = await ctx.db
      .query("communications")
      .withIndex("by_outbound_id", (q) => q.eq("outboundId", args.outboundId))
      .unique();
    if (!communication || communication.caseId !== args.caseId) return null;
    const deliveryState = args.status === "pending" ? "queued" : args.status;
    const now = Date.now();
    const changed = communication.deliveryState !== deliveryState;
    await ctx.db.patch(communication._id, {
      deliveryState,
      ...(args.agentmailMessageId ? { agentmailMessageId: args.agentmailMessageId } : {}),
      ...(args.threadId ? { agentmailThreadId: args.threadId } : {}),
      ...(["sent", "delivered"].includes(deliveryState) && !communication.sentAt
        ? { sentAt: now }
        : {}),
      ...(deliveryState === "delivered" ? { deliveredAt: now } : {}),
    });
    if (changed) {
      await ctx.db.insert("timelineEvents", {
        caseId: args.caseId,
        eventType: `agentmail.${deliveryState}`,
        actorType: "agentmail",
        visibility: "private",
        payloadVersion: "1",
        summary: `AgentMail updated the controlled delivery to ${deliveryState}.`,
        timestamp: now,
        idempotencyKey: `agentmail:${args.outboundId}:${deliveryState}`,
      });
    }
    return null;
  },
});

export const syncOutboundStatus = internalAction({
  args: { caseId: v.id("cases"), outboundId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = await ctx.runQuery(internal.approvals.readOutboundStatus, {
      outboundId: args.outboundId,
    });
    if (!status) return null;
    await ctx.runMutation(internal.approvals.persistOutboundStatus, {
      ...args,
      status: status.status,
      ...(status.agentmailMessageId ? { agentmailMessageId: status.agentmailMessageId } : {}),
      ...(status.threadId ? { threadId: status.threadId } : {}),
    });
    return null;
  },
});

export const readOutboundStatus = internalQuery({
  args: { outboundId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("complained"),
        v.literal("rejected"),
        v.literal("failed"),
      ),
      agentmailMessageId: v.union(v.string(), v.null()),
      threadId: v.union(v.string(), v.null()),
      errorMessage: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    return await agentmail.status(ctx, args.outboundId as OutboundId);
  },
});

export const syncPendingOutbounds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const candidates = await ctx.runQuery(internal.approvals.listOutboundSyncCandidates, {});
    for (const candidate of candidates) {
      await ctx.runAction(internal.approvals.syncOutboundStatus, candidate);
    }
    return null;
  },
});

export const rejectDraft = mutation({
  args: {
    publicId: v.string(),
    capabilityToken: v.optional(v.string()),
    approvalId: v.id("approvals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    const approval = await ctx.db.get("approvals", args.approvalId);
    if (!approval || approval.caseId !== caseDocument._id) throw new Error("APPROVAL_NOT_FOUND");
    if (approval.state !== "pending" || caseDocument.currentState !== "AWAITING_APPROVAL") {
      throw new Error("APPROVAL_NOT_PENDING");
    }
    assertTransition(caseDocument.currentState, "ACTIONABLE");
    const now = Date.now();
    await ctx.db.patch(approval._id, { state: "rejected" });
    await ctx.db.patch(caseDocument._id, {
      currentState: "ACTIONABLE",
      nextAction: "Draft cancelled. Review or edit a new message to the verified recipient.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "approval.rejected",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary: "The consumer cancelled the outbound draft before any message was sent.",
      timestamp: now,
      idempotencyKey: `approval:${approval._id}:rejected`,
    });
    return null;
  },
});

export const sendStatus = query({
  args: {
    publicId: v.string(),
    capabilityToken: v.optional(v.string()),
    outboundId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      agentmailMessageId: v.union(v.string(), v.null()),
      threadId: v.union(v.string(), v.null()),
      errorMessage: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseAccess(ctx, args.publicId, args.capabilityToken);
    const communication = await ctx.db
      .query("communications")
      .withIndex("by_outbound_id", (q) => q.eq("outboundId", args.outboundId))
      .unique();
    if (!communication || communication.caseId !== caseDocument._id)
      throw new Error("SEND_NOT_FOUND");
    return await agentmail.status(ctx, args.outboundId as OutboundId);
  },
});
