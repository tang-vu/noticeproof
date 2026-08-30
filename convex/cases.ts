import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  createCapabilityToken,
  hashCapabilityToken,
  requireCaseAccess,
  requireCaseWriteAccess,
  sha256,
} from "./lib/access";
import { rawRetentionUntil } from "./lib/retention";
import { purgeOutboundPayload } from "./lib/outboundPayload";
import { appendEvidenceReceipt } from "./lib/receipts";
import {
  approvalState,
  authorityTier,
  caseState,
  evidenceRelation,
  inputKind,
  riskLevel,
  sourceSpan,
  verdictCode,
} from "./model/validators";
import { sanitizePlainText } from "../shared/domain/redaction";
import { assertTransition } from "../shared/domain/stateMachine";

const MAX_NOTICE_LENGTH = 40_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function createForwardingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export const createForwardingSession = mutation({
  args: {},
  returns: v.object({
    publicId: v.string(),
    capabilityToken: v.string(),
    forwardingSubject: v.string(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const windowStart = Math.floor(now / 60_000) * 60_000;
    const rateLimit = await ctx.db
      .query("rateLimits")
      .withIndex("by_scope_action_window", (q) =>
        q
          .eq("scopeHash", "public-intake")
          .eq("action", "createForwardingSession")
          .eq("windowStart", windowStart),
      )
      .unique();
    if (rateLimit && rateLimit.count >= 10) throw new Error("RATE_LIMITED");
    if (rateLimit) {
      await ctx.db.patch(rateLimit._id, { count: rateLimit.count + 1, updatedAt: now });
    } else {
      await ctx.db.insert("rateLimits", {
        scopeHash: "public-intake",
        action: "createForwardingSession",
        windowStart,
        count: 1,
        updatedAt: now,
      });
    }

    const capabilityToken = createCapabilityToken();
    const forwardingCode = createForwardingCode();
    const publicId = `np_mail_${crypto.randomUUID().replaceAll("-", "")}`;
    const sessionExpiresAt = now + 24 * 60 * 60 * 1000;
    const caseId = await ctx.db.insert("cases", {
      publicId,
      capabilityHash: await hashCapabilityToken(capabilityToken),
      forwardingCodeHash: await hashCapabilityToken(forwardingCode),
      forwardingSessionExpiresAt: sessionExpiresAt,
      inputKind: "forwarded_email",
      currentState: "RECEIVED",
      riskLevel: "unknown",
      nextAction: "Forward the notice with the private tracking code in its subject.",
      currentVerdictVersion: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      rawRetentionUntil: rawRetentionUntil(now),
      isDemo: false,
      isPublicFixture: false,
    });
    await ctx.db.insert("timelineEvents", {
      caseId,
      eventType: "agentmail.forwarding_session_created",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary: "A one-time AgentMail forwarding session was created.",
      timestamp: now,
      idempotencyKey: `forwarding-session:${caseId}`,
    });
    return {
      publicId,
      capabilityToken,
      forwardingSubject: `[NP-${forwardingCode}] Recall notice for verification`,
    };
  },
});

export const generateScreenshotUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const now = Date.now();
    const windowStart = Math.floor(now / 60_000) * 60_000;
    const rateLimit = await ctx.db
      .query("rateLimits")
      .withIndex("by_scope_action_window", (q) =>
        q
          .eq("scopeHash", "public-intake")
          .eq("action", "screenshotUpload")
          .eq("windowStart", windowStart),
      )
      .unique();
    if (rateLimit && rateLimit.count >= 10) throw new Error("RATE_LIMITED");
    if (rateLimit) {
      await ctx.db.patch(rateLimit._id, { count: rateLimit.count + 1, updatedAt: now });
    } else {
      await ctx.db.insert("rateLimits", {
        scopeHash: "public-intake",
        action: "screenshotUpload",
        windowStart,
        count: 1,
        updatedAt: now,
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const createScreenshot = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    mediaType: v.string(),
    size: v.number(),
    accompanyingText: v.optional(v.string()),
  },
  returns: v.object({ publicId: v.string(), capabilityToken: v.string() }),
  handler: async (ctx, args) => {
    if (
      !IMAGE_MEDIA_TYPES.has(args.mediaType) ||
      args.size <= 0 ||
      args.size > MAX_IMAGE_BYTES ||
      args.fileName.length > 200 ||
      (args.accompanyingText?.length ?? 0) > MAX_NOTICE_LENGTH
    ) {
      throw new Error("SCREENSHOT_METADATA_INVALID");
    }
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      metadata.size !== args.size ||
      metadata.size > MAX_IMAGE_BYTES ||
      (metadata.contentType !== undefined && metadata.contentType !== args.mediaType)
    ) {
      throw new Error("SCREENSHOT_STORAGE_INVALID");
    }
    const now = Date.now();
    const capabilityToken = createCapabilityToken();
    const publicId = `np_${crypto.randomUUID().replaceAll("-", "")}`;
    const sanitizedBody = sanitizePlainText(
      args.accompanyingText?.trim() || "[Screenshot submitted for claim extraction.]",
      MAX_NOTICE_LENGTH,
    );
    const canonicalNoticeHash = await sha256(`screenshot\n${metadata.sha256}\n${sanitizedBody}`);
    const caseId = await ctx.db.insert("cases", {
      publicId,
      capabilityHash: await hashCapabilityToken(capabilityToken),
      inputKind: "screenshot",
      currentState: "RECEIVED",
      riskLevel: "unknown",
      nextAction: "Screenshot received. Claim extraction has not started yet.",
      currentVerdictVersion: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      isDemo: false,
      isPublicFixture: false,
      rawRetentionUntil: rawRetentionUntil(now),
    });
    await ctx.db.insert("notices", {
      caseId,
      subject: "Uploaded recall screenshot",
      sender: "Sender not provided",
      bodyPreview: sanitizedBody.slice(0, 500),
      sanitizedBody,
      attachmentMetadata: [
        {
          name: args.fileName,
          mediaType: args.mediaType,
          size: args.size,
          storageId: args.storageId,
        },
      ],
      rawStorageId: args.storageId,
      canonicalNoticeHash,
      createdAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId,
      eventType: "notice.screenshot_received",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary: "A private screenshot was received and scheduled for retention cleanup.",
      timestamp: now,
      idempotencyKey: `notice:${canonicalNoticeHash}`,
    });
    return { publicId, capabilityToken };
  },
});

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
    const caseId = await ctx.db.insert("cases", {
      publicId,
      capabilityHash: await hashCapabilityToken(capabilityToken),
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
      rawRetentionUntil: rawRetentionUntil(now),
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
    case: v.object({
      publicId: v.string(),
      inputKind,
      currentState: caseState,
      currentVerdictCode: v.optional(verdictCode),
      riskLevel,
      nextAction: v.string(),
      currentVerdictVersion: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.number(),
      lastCheckedAt: v.optional(v.number()),
      isDemo: v.boolean(),
      isPublicFixture: v.boolean(),
      rawContentPurgedAt: v.optional(v.number()),
    }),
    notices: v.array(
      v.object({
        subject: v.string(),
        sender: v.string(),
        bodyPreview: v.string(),
        attachmentMetadata: v.array(
          v.object({ name: v.string(), mediaType: v.string(), size: v.number() }),
        ),
        createdAt: v.number(),
      }),
    ),
    claims: v.array(
      v.object({
        _id: v.id("claims"),
        claimType: v.string(),
        rawValue: v.string(),
        normalizedValue: v.string(),
        sourceSpan,
        confidence: v.number(),
        matchCritical: v.boolean(),
      }),
    ),
    sources: v.array(
      v.object({
        _id: v.id("sources"),
        canonicalUrl: v.string(),
        canonicalDomain: v.string(),
        sourceType: v.string(),
        authorityTier,
        discoveredFromSourceId: v.optional(v.id("sources")),
        fetchedAt: v.number(),
        status: v.string(),
        title: v.string(),
        sourceUpdatedAt: v.optional(v.number()),
        contentHash: v.optional(v.string()),
        truncated: v.boolean(),
        extractionStatus: v.string(),
        verifiesContact: v.boolean(),
        verifiedEmail: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
    evidenceEdges: v.array(
      v.object({
        _id: v.id("evidenceEdges"),
        claimId: v.id("claims"),
        sourceId: v.id("sources"),
        relation: evidenceRelation,
        matchMethod: v.string(),
        ruleId: v.string(),
        locator: v.string(),
        excerpt: v.string(),
        createdAt: v.number(),
      }),
    ),
    verdicts: v.array(
      v.object({
        _id: v.id("verdicts"),
        version: v.number(),
        code: verdictCode,
        ruleEngineVersion: v.string(),
        summary: v.string(),
        missingIdentifiers: v.array(v.string()),
        eligibleActions: v.array(v.string()),
        blockingReasons: v.array(v.string()),
        claimEnvelopeHash: v.string(),
        evidenceManifestHash: v.string(),
        ruleResults: v.array(
          v.object({
            ruleId: v.string(),
            outcome: v.string(),
            evidenceIds: v.array(v.string()),
          }),
        ),
        createdAt: v.number(),
      }),
    ),
    verdictExplanations: v.array(
      v.object({
        _id: v.id("verdictExplanations"),
        verdictId: v.id("verdicts"),
        verdictVersion: v.number(),
        model: v.string(),
        templateIds: v.array(v.string()),
        referencedRuleIds: v.array(v.string()),
        text: v.string(),
        inputHash: v.string(),
        createdAt: v.number(),
      }),
    ),
    approvals: v.array(
      v.object({
        _id: v.id("approvals"),
        actionType: v.string(),
        intendedRecipient: v.string(),
        actualRecipient: v.string(),
        verifiedRecipientSourceId: v.id("sources"),
        redactedPreview: v.string(),
        payloadHash: v.string(),
        verdictVersion: v.number(),
        evidenceManifestHash: v.string(),
        state: approvalState,
        expiresAt: v.number(),
        approvedAt: v.optional(v.number()),
        consumedAt: v.optional(v.number()),
        createdAt: v.number(),
      }),
    ),
    communications: v.array(
      v.object({
        _id: v.id("communications"),
        outboundId: v.optional(v.string()),
        direction: v.union(v.literal("outbound"), v.literal("inbound")),
        intendedRecipient: v.optional(v.string()),
        actualRecipient: v.optional(v.string()),
        verifiedRecipientSourceId: v.optional(v.id("sources")),
        deliveryState: v.string(),
        redactedSummary: v.string(),
        attachmentMetadata: v.array(
          v.object({ name: v.string(), mediaType: v.string(), size: v.number() }),
        ),
        sentAt: v.optional(v.number()),
        deliveredAt: v.optional(v.number()),
        receivedAt: v.optional(v.number()),
        createdAt: v.number(),
      }),
    ),
    timeline: v.array(
      v.object({
        _id: v.id("timelineEvents"),
        eventType: v.string(),
        actorType: v.string(),
        visibility: v.string(),
        payloadVersion: v.string(),
        summary: v.string(),
        timestamp: v.number(),
      }),
    ),
    evidenceReceipts: v.array(
      v.object({
        _id: v.id("evidenceReceipts"),
        receiptVersion: v.string(),
        noticeHash: v.string(),
        claimEnvelopeHash: v.string(),
        verdictHash: v.string(),
        evidenceManifestHash: v.string(),
        approvalHash: v.optional(v.string()),
        timelineHash: v.string(),
        humanSummary: v.string(),
        machineJson: v.string(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseAccess(ctx, args.publicId, args.capabilityToken);
    const [
      notices,
      claims,
      sources,
      evidenceEdges,
      verdicts,
      verdictExplanations,
      approvals,
      communications,
      timeline,
      evidenceReceipts,
    ] = await Promise.all([
      ctx.db
        .query("notices")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(10),
      ctx.db
        .query("claims")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(100),
      ctx.db
        .query("sources")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(50),
      ctx.db
        .query("evidenceEdges")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(200),
      ctx.db
        .query("verdicts")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(20),
      ctx.db
        .query("verdictExplanations")
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
      ctx.db
        .query("evidenceReceipts")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .order("desc")
        .take(20),
    ]);
    return {
      case: {
        publicId: caseDocument.publicId,
        inputKind: caseDocument.inputKind,
        currentState: caseDocument.currentState,
        ...(caseDocument.currentVerdictCode
          ? { currentVerdictCode: caseDocument.currentVerdictCode }
          : {}),
        riskLevel: caseDocument.riskLevel,
        nextAction: caseDocument.nextAction,
        currentVerdictVersion: caseDocument.currentVerdictVersion,
        createdAt: caseDocument.createdAt,
        updatedAt: caseDocument.updatedAt,
        expiresAt: caseDocument.expiresAt,
        ...(caseDocument.lastCheckedAt ? { lastCheckedAt: caseDocument.lastCheckedAt } : {}),
        isDemo: caseDocument.isDemo,
        isPublicFixture: caseDocument.isPublicFixture,
        ...(caseDocument.rawContentPurgedAt
          ? { rawContentPurgedAt: caseDocument.rawContentPurgedAt }
          : {}),
      },
      notices: notices.map(({ subject, sender, bodyPreview, attachmentMetadata, createdAt }) => ({
        subject,
        sender,
        bodyPreview,
        attachmentMetadata: attachmentMetadata.map(({ name, mediaType, size }) => ({
          name,
          mediaType,
          size,
        })),
        createdAt,
      })),
      claims: claims.map(
        ({ _id, claimType, rawValue, normalizedValue, sourceSpan, confidence, matchCritical }) => ({
          _id,
          claimType,
          rawValue,
          normalizedValue,
          sourceSpan,
          confidence,
          matchCritical,
        }),
      ),
      sources: sources.map(
        ({
          _id,
          canonicalUrl,
          canonicalDomain,
          sourceType,
          authorityTier,
          discoveredFromSourceId,
          fetchedAt,
          status,
          title,
          sourceUpdatedAt,
          contentHash,
          truncated,
          extractionStatus,
          verifiesContact,
          verifiedEmail,
          createdAt,
        }) => ({
          _id,
          canonicalUrl,
          canonicalDomain,
          sourceType,
          authorityTier,
          ...(discoveredFromSourceId ? { discoveredFromSourceId } : {}),
          fetchedAt,
          status,
          title,
          ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
          ...(contentHash ? { contentHash } : {}),
          truncated,
          extractionStatus,
          verifiesContact,
          ...(verifiedEmail ? { verifiedEmail } : {}),
          createdAt,
        }),
      ),
      evidenceEdges: evidenceEdges.map(
        ({
          _id,
          claimId,
          sourceId,
          relation,
          matchMethod,
          ruleId,
          locator,
          excerpt,
          createdAt,
        }) => ({
          _id,
          claimId,
          sourceId,
          relation,
          matchMethod,
          ruleId,
          locator,
          excerpt,
          createdAt,
        }),
      ),
      verdicts: verdicts.map(
        ({
          _id,
          version,
          code,
          ruleEngineVersion,
          summary,
          missingIdentifiers,
          eligibleActions,
          blockingReasons,
          claimEnvelopeHash,
          evidenceManifestHash,
          ruleResults,
          createdAt,
        }) => ({
          _id,
          version,
          code,
          ruleEngineVersion,
          summary,
          missingIdentifiers,
          eligibleActions,
          blockingReasons,
          claimEnvelopeHash,
          evidenceManifestHash,
          ruleResults,
          createdAt,
        }),
      ),
      verdictExplanations: verdictExplanations.map(
        ({
          _id,
          verdictId,
          verdictVersion,
          model,
          templateIds,
          referencedRuleIds,
          text,
          inputHash,
          createdAt,
        }) => ({
          _id,
          verdictId,
          verdictVersion,
          model,
          templateIds,
          referencedRuleIds,
          text,
          inputHash,
          createdAt,
        }),
      ),
      approvals: approvals.map(
        ({
          _id,
          actionType,
          intendedRecipient,
          actualRecipient,
          verifiedRecipientSourceId,
          redactedPreview,
          payloadHash,
          verdictVersion,
          evidenceManifestHash,
          state,
          expiresAt,
          approvedAt,
          consumedAt,
          createdAt,
        }) => ({
          _id,
          actionType,
          intendedRecipient,
          actualRecipient,
          verifiedRecipientSourceId,
          redactedPreview,
          payloadHash,
          verdictVersion,
          evidenceManifestHash,
          state,
          expiresAt,
          ...(approvedAt ? { approvedAt } : {}),
          ...(consumedAt ? { consumedAt } : {}),
          createdAt,
        }),
      ),
      communications: communications.map(
        ({
          _id,
          outboundId,
          direction,
          intendedRecipient,
          actualRecipient,
          verifiedRecipientSourceId,
          deliveryState,
          redactedSummary,
          attachmentMetadata,
          sentAt,
          deliveredAt,
          receivedAt,
          createdAt,
        }) => ({
          _id,
          ...(outboundId ? { outboundId } : {}),
          direction,
          ...(intendedRecipient ? { intendedRecipient } : {}),
          ...(actualRecipient ? { actualRecipient } : {}),
          ...(verifiedRecipientSourceId ? { verifiedRecipientSourceId } : {}),
          deliveryState,
          redactedSummary,
          attachmentMetadata,
          ...(sentAt ? { sentAt } : {}),
          ...(deliveredAt ? { deliveredAt } : {}),
          ...(receivedAt ? { receivedAt } : {}),
          createdAt,
        }),
      ),
      timeline: timeline.map(
        ({ _id, eventType, actorType, visibility, payloadVersion, summary, timestamp }) => ({
          _id,
          eventType,
          actorType,
          visibility,
          payloadVersion,
          summary,
          timestamp,
        }),
      ),
      evidenceReceipts: evidenceReceipts.map(
        ({
          _id,
          receiptVersion,
          noticeHash,
          claimEnvelopeHash,
          verdictHash,
          evidenceManifestHash,
          approvalHash,
          timelineHash,
          humanSummary,
          machineJson,
          createdAt,
        }) => ({
          _id,
          receiptVersion,
          noticeHash,
          claimEnvelopeHash,
          verdictHash,
          evidenceManifestHash,
          ...(approvalHash ? { approvalHash } : {}),
          timelineHash,
          humanSummary,
          machineJson,
          createdAt,
        }),
      ),
    };
  },
});

export const listPublicDemos = query({
  args: {},
  returns: v.array(
    v.object({
      publicId: v.string(),
      currentState: caseState,
      currentVerdictCode: v.optional(verdictCode),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const demos = await ctx.db
      .query("cases")
      .withIndex("by_public_fixture", (q) => q.eq("isPublicFixture", true))
      .take(10);
    return demos.map(({ publicId, currentState, currentVerdictCode, updatedAt }) => ({
      publicId,
      currentState,
      ...(currentVerdictCode ? { currentVerdictCode } : {}),
      updatedAt,
    }));
  },
});

export const updateResolution = mutation({
  args: {
    publicId: v.string(),
    capabilityToken: v.optional(v.string()),
    action: v.union(v.literal("confirm_remedy"), v.literal("resolve")),
  },
  returns: v.object({ state: caseState }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    const nextState = args.action === "confirm_remedy" ? "REMEDY_CONFIRMED" : "RESOLVED";
    assertTransition(caseDocument.currentState, nextState);
    const now = Date.now();
    await ctx.db.patch(caseDocument._id, {
      currentState: nextState,
      nextAction:
        nextState === "REMEDY_CONFIRMED"
          ? "You confirmed the remedy instructions. Mark resolved only after your human process is complete."
          : "You marked this case resolved. NoticeProof does not independently claim the remedy was fulfilled.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType:
        nextState === "REMEDY_CONFIRMED" ? "remedy.consumer_confirmed" : "case.consumer_resolved",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary:
        nextState === "REMEDY_CONFIRMED"
          ? "The consumer confirmed receiving usable remedy instructions."
          : "The consumer marked their own case resolved.",
      timestamp: now,
      idempotencyKey: `case:${caseDocument._id}:${nextState}:${now}`,
    });
    await appendEvidenceReceipt(
      ctx,
      caseDocument._id,
      nextState === "REMEDY_CONFIRMED" ? "remedy_confirmed" : "case_resolved",
      now,
    );
    return { state: nextState } as const;
  },
});

export const purgePrivateSourceData = mutation({
  args: { publicId: v.string(), capabilityToken: v.optional(v.string()) },
  returns: v.object({ state: caseState, rawContentPurgedAt: v.number() }),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseWriteAccess(ctx, args.publicId, args.capabilityToken);
    if (caseDocument.rawContentPurgedAt) {
      return {
        state: caseDocument.currentState,
        rawContentPurgedAt: caseDocument.rawContentPurgedAt,
      };
    }
    if (caseDocument.currentState === "CONTACTING_VERIFIED_CHANNEL") {
      throw new Error("PRIVACY_PURGE_RETRY");
    }

    const [notices, claims, communications, approvals] = await Promise.all([
      ctx.db
        .query("notices")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(10),
      ctx.db
        .query("claims")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(100),
      ctx.db
        .query("communications")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(50),
      ctx.db
        .query("approvals")
        .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
        .take(20),
    ]);

    const storageIds = new Set(
      notices.flatMap((notice) => [
        ...(notice.rawStorageId ? [notice.rawStorageId] : []),
        ...notice.attachmentMetadata.flatMap((attachment) =>
          attachment.storageId ? [attachment.storageId] : [],
        ),
      ]),
    );
    for (const storageId of storageIds) await ctx.storage.delete(storageId);

    for (const notice of notices) {
      await ctx.db.patch(notice._id, {
        subject: "[purged by consumer]",
        sender: "[purged by consumer]",
        bodyPreview: "[private source content purged by consumer]",
        sanitizedBody: "[private source content purged by consumer]",
        rawStorageId: undefined,
        attachmentMetadata: notice.attachmentMetadata.map(({ mediaType, size }) => ({
          name: "[purged]",
          mediaType,
          size,
        })),
      });
    }
    for (const claim of claims) {
      await ctx.db.patch(claim._id, {
        rawValue: "[source quote purged]",
        sourceSpan: { ...claim.sourceSpan, quote: "[source quote purged]" },
        ...(["claimed_sender", "email", "phone", "order_number", "physical_destination"].includes(
          claim.claimType,
        )
          ? { normalizedValue: "[private value purged]" }
          : {}),
      });
    }
    for (const communication of communications) {
      if (communication.direction === "inbound") {
        await ctx.db.patch(communication._id, {
          redactedSummary: "[private inbound summary purged by consumer]",
        });
      }
    }
    for (const approval of approvals) {
      if (approval.state === "pending") await ctx.db.patch(approval._id, { state: "expired" });
      await purgeOutboundPayload(ctx, approval._id);
    }

    const now = Date.now();
    const nextState =
      caseDocument.currentState === "RESOLVED" || caseDocument.currentState === "CLOSED_UNRESOLVED"
        ? caseDocument.currentState
        : "CLOSED_UNRESOLVED";
    if (nextState === "CLOSED_UNRESOLVED" && caseDocument.currentState !== "CLOSED_UNRESOLVED") {
      assertTransition(caseDocument.currentState, nextState);
    }
    await ctx.db.patch(caseDocument._id, {
      currentState: nextState,
      nextAction:
        "Private source content was purged at your request. Derived hashes and public authority evidence remain for auditability.",
      forwardingCodeHash: undefined,
      forwardingSessionExpiresAt: undefined,
      rawContentPurgedAt: now,
      rawRetentionUntil: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "privacy.source_data_purged",
      actorType: "consumer",
      visibility: "private",
      payloadVersion: "1",
      summary: "The consumer purged private source content and revoked pending actions.",
      timestamp: now,
      idempotencyKey: `privacy:source-purge:${caseDocument._id}`,
    });
    return { state: nextState, rawContentPurgedAt: now };
  },
});
