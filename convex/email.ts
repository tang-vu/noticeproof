import { v } from "convex/values";
import { redactSensitiveText, sanitizePlainText } from "../shared/domain/redaction";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { createCapabilityToken, hashCapabilityToken, sha256 } from "./lib/access";
import { recordIntegrationProof } from "./integrationProofs";
import { rawRetentionUntil } from "./lib/retention";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("AGENTMAIL_PAYLOAD_INVALID");
  return value as Record<string, unknown>;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = optionalString(record, key);
  if (!value) throw new Error(`AGENTMAIL_${key.toUpperCase()}_MISSING`);
  return value;
}

export const onMessageReceived = internalMutation({
  // The component contract uses v.any() for message/thread; every consumed field is narrowed below.
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const idempotencyKey = `agentmail:event:${args.eventId}`;
    const prior = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_key", (q) => q.eq("key", idempotencyKey))
      .unique();
    if (prior) return null;

    const message = asRecord(args.message as unknown);
    const messageId = requiredString(message, "message_id");
    const inboxId = requiredString(message, "inbox_id");
    const threadId = requiredString(message, "thread_id");
    const sender = sanitizePlainText(optionalString(message, "from") ?? "Unknown sender", 300);
    const subject = sanitizePlainText(
      optionalString(message, "subject") ?? "Forwarded recall notice",
      300,
    );
    const body = sanitizePlainText(
      optionalString(message, "extracted_text") ??
        optionalString(message, "text") ??
        optionalString(message, "preview") ??
        "",
      40_000,
    );
    if (!body) throw new Error("AGENTMAIL_MESSAGE_BODY_EMPTY");

    const now = Date.now();
    const canonicalNoticeHash = await sha256(`${subject}\n${sender}\n${body}`);
    const existingNotice = await ctx.db
      .query("notices")
      .withIndex("by_agentmail_inbound_id", (q) => q.eq("agentmailInboundId", messageId))
      .unique();
    if (existingNotice) {
      await ctx.db.insert("idempotencyKeys", {
        key: idempotencyKey,
        operation: "agentmail.inbound.duplicate",
        caseId: existingNotice.caseId,
        createdAt: now,
      });
      return null;
    }

    const existingThread = await ctx.db
      .query("communications")
      .withIndex("by_agentmail_thread_id", (q) => q.eq("agentmailThreadId", threadId))
      .first();
    if (existingThread) {
      const caseDocument = await ctx.db.get("cases", existingThread.caseId);
      if (!caseDocument) throw new Error("AGENTMAIL_CASE_MISSING");
      await ctx.db.insert("communications", {
        caseId: caseDocument._id,
        agentmailThreadId: threadId,
        agentmailMessageId: messageId,
        direction: "inbound",
        deliveryState: "received",
        redactedSummary: redactSensitiveText(body).slice(0, 500),
        attachmentMetadata: [],
        receivedAt: now,
        createdAt: now,
      });
      await ctx.db.patch(caseDocument._id, {
        nextAction:
          "A reply arrived on the trusted AgentMail thread. Review it before confirming the remedy.",
        updatedAt: now,
      });
      await ctx.db.insert("timelineEvents", {
        caseId: caseDocument._id,
        eventType: "agentmail.reply_received",
        actorType: "agentmail",
        visibility: "private",
        payloadVersion: "1",
        summary: "AgentMail attached an inbound reply to the existing trusted thread.",
        timestamp: now,
        idempotencyKey,
      });
      await ctx.db.insert("idempotencyKeys", {
        key: idempotencyKey,
        operation: "agentmail.inbound.attached_reply",
        caseId: caseDocument._id,
        resultJson: JSON.stringify({ publicId: caseDocument.publicId, inboxId }),
        createdAt: now,
      });
      return null;
    }

    const forwardingCode = subject.match(/\[NP-([A-F0-9]{24})\]/i)?.[1]?.toUpperCase();
    const forwardingCodeHash = forwardingCode
      ? await hashCapabilityToken(forwardingCode)
      : undefined;
    const forwardingCase = forwardingCodeHash
      ? await ctx.db
          .query("cases")
          .withIndex("by_forwarding_code_hash", (q) =>
            q.eq("forwardingCodeHash", forwardingCodeHash),
          )
          .unique()
      : null;
    if (
      forwardingCase &&
      (forwardingCase.forwardingClaimedAt ||
        !forwardingCase.forwardingSessionExpiresAt ||
        forwardingCase.forwardingSessionExpiresAt < now ||
        forwardingCase.currentState !== "RECEIVED")
    ) {
      await ctx.db.insert("idempotencyKeys", {
        key: idempotencyKey,
        operation: "agentmail.inbound.forwarding_session_rejected",
        caseId: forwardingCase._id,
        createdAt: now,
      });
      return null;
    }

    let caseId: Id<"cases">;
    let publicId: string;
    if (forwardingCase) {
      caseId = forwardingCase._id;
      publicId = forwardingCase.publicId;
      await ctx.db.patch(caseId, {
        forwardingClaimedAt: now,
        nextAction: "The forwarded notice is waiting for bounded claim extraction.",
        updatedAt: now,
      });
    } else {
      const capabilityToken = createCapabilityToken();
      publicId = `np_mail_${crypto.randomUUID().replaceAll("-", "")}`;
      caseId = await ctx.db.insert("cases", {
        publicId,
        capabilityHash: await hashCapabilityToken(capabilityToken),
        inputKind: "forwarded_email",
        currentState: "RECEIVED",
        riskLevel: "unknown",
        nextAction: "The forwarded notice is waiting for bounded claim extraction.",
        currentVerdictVersion: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        rawRetentionUntil: rawRetentionUntil(now),
        isDemo: false,
        isPublicFixture: false,
      });
    }
    await ctx.db.insert("notices", {
      caseId,
      agentmailInboundId: messageId,
      subject,
      sender,
      bodyPreview: body.slice(0, 500),
      sanitizedBody: body,
      attachmentMetadata: [],
      canonicalNoticeHash,
      createdAt: now,
    });
    await ctx.db.insert("communications", {
      caseId,
      agentmailThreadId: threadId,
      agentmailMessageId: messageId,
      direction: "inbound",
      deliveryState: "received",
      redactedSummary: redactSensitiveText(body).slice(0, 500),
      attachmentMetadata: [],
      receivedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId,
      eventType: "agentmail.message_received",
      actorType: "agentmail",
      visibility: "private",
      payloadVersion: "1",
      summary: "AgentMail verified and persisted a deliberately forwarded notice.",
      timestamp: now,
      idempotencyKey,
    });
    await ctx.db.insert("idempotencyKeys", {
      key: idempotencyKey,
      operation: forwardingCase
        ? "agentmail.inbound.attached_forwarding_session"
        : "agentmail.inbound.created_case",
      caseId,
      resultJson: JSON.stringify({ publicId, inboxId }),
      createdAt: now,
    });
    await recordIntegrationProof(ctx, {
      proofKey: "agentmail.inbound",
      sponsor: "AgentMail",
      milestone: "Signed inbound received",
      detail: "A verified webhook created or attached a private case idempotently.",
      status: "verified",
      verifiedAt: now,
    });
    const extractionKey = `openai:extract:${caseId}:agentmail:${messageId}`;
    await ctx.db.insert("idempotencyKeys", {
      key: extractionKey,
      operation: "openai.extract.scheduled",
      caseId,
      createdAt: now,
    });
    await ctx.db.patch(caseId, {
      currentState: "EXTRACTING_CLAIMS",
      nextAction: "Claims are being extracted from the deliberately forwarded notice.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId,
      eventType: "claims.extraction_started",
      actorType: "system",
      visibility: "private",
      payloadVersion: "1",
      summary: "Schema-constrained claim extraction started for the forwarded notice.",
      timestamp: now,
      idempotencyKey: `${extractionKey}:timeline`,
    });
    await ctx.scheduler.runAfter(0, internal.openaiExtraction.extract, { caseId });
    return null;
  },
});
