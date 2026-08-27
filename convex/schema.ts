import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  approvalState,
  authorityTier,
  caseState,
  evidenceRelation,
  inputKind,
  noticeType,
  riskLevel,
  sourceSpan,
  verdictCode,
} from "./model/validators";

export default defineSchema({
  cases: defineTable({
    publicId: v.string(),
    capabilityHash: v.string(),
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
    rawRetentionUntil: v.optional(v.number()),
    fixtureVersion: v.optional(v.string()),
  })
    .index("by_public_id", ["publicId"])
    .index("by_public_fixture", ["isPublicFixture"])
    .index("by_expiry", ["expiresAt"])
    .index("by_state", ["currentState"])
    .index("by_raw_retention", ["rawRetentionUntil"]),

  notices: defineTable({
    caseId: v.id("cases"),
    agentmailInboundId: v.optional(v.string()),
    subject: v.string(),
    sender: v.string(),
    bodyPreview: v.string(),
    attachmentMetadata: v.array(
      v.object({
        name: v.string(),
        mediaType: v.string(),
        size: v.number(),
        storageId: v.optional(v.id("_storage")),
      }),
    ),
    rawStorageId: v.optional(v.id("_storage")),
    canonicalNoticeHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_notice_hash", ["canonicalNoticeHash"])
    .index("by_agentmail_inbound_id", ["agentmailInboundId"]),

  claimEnvelopes: defineTable({
    caseId: v.id("cases"),
    noticeId: v.id("notices"),
    schemaVersion: v.string(),
    model: v.string(),
    modelResponseId: v.optional(v.string()),
    language: v.string(),
    noticeType,
    manufacturer: v.optional(v.string()),
    productName: v.optional(v.string()),
    recallId: v.optional(v.string()),
    claimedHazard: v.optional(v.string()),
    claimedRemedy: v.optional(v.string()),
    requestedSensitiveKinds: v.array(v.string()),
    validationStatus: v.union(v.literal("valid"), v.literal("invalid"), v.literal("retryable")),
    extractionErrorCode: v.optional(v.string()),
    contentHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_notice_id", ["noticeId"])
    .index("by_content_hash", ["contentHash"]),

  claims: defineTable({
    caseId: v.id("cases"),
    claimEnvelopeId: v.id("claimEnvelopes"),
    claimType: v.string(),
    rawValue: v.string(),
    normalizedValue: v.string(),
    sourceSpan,
    confidence: v.number(),
    matchCritical: v.boolean(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_envelope_id", ["claimEnvelopeId"])
    .index("by_case_and_type", ["caseId", "claimType"]),

  sources: defineTable({
    caseId: v.id("cases"),
    canonicalUrl: v.string(),
    canonicalDomain: v.string(),
    sourceType: v.union(
      v.literal("cpsc_record"),
      v.literal("manufacturer_page"),
      v.literal("retailer_page"),
      v.literal("notice"),
      v.literal("search_result"),
    ),
    authorityTier,
    discoveredFromSourceId: v.optional(v.id("sources")),
    fetchedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("scraping"),
      v.literal("crawling"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    title: v.string(),
    sourceUpdatedAt: v.optional(v.number()),
    contentHash: v.optional(v.string()),
    snapshotStorageId: v.optional(v.id("_storage")),
    truncated: v.boolean(),
    extractionStatus: v.union(
      v.literal("pending"),
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("not_needed"),
    ),
    verifiesContact: v.boolean(),
    crawlId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_case_and_url", ["caseId", "canonicalUrl"])
    .index("by_crawl_id", ["crawlId"])
    .index("by_discovered_from_source_id", ["discoveredFromSourceId"]),

  evidenceEdges: defineTable({
    caseId: v.id("cases"),
    claimId: v.id("claims"),
    sourceId: v.id("sources"),
    relation: evidenceRelation,
    matchMethod: v.string(),
    ruleId: v.string(),
    locator: v.string(),
    excerpt: v.string(),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_claim_id", ["claimId"])
    .index("by_source_id", ["sourceId"]),

  verdicts: defineTable({
    caseId: v.id("cases"),
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
        outcome: v.union(
          v.literal("pass"),
          v.literal("fail"),
          v.literal("blocked"),
          v.literal("unresolved"),
        ),
        evidenceIds: v.array(v.string()),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_case_and_version", ["caseId", "version"]),

  approvals: defineTable({
    caseId: v.id("cases"),
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
  })
    .index("by_case_id", ["caseId"])
    .index("by_case_and_state", ["caseId", "state"])
    .index("by_payload_hash", ["payloadHash"]),

  communications: defineTable({
    caseId: v.id("cases"),
    agentmailThreadId: v.optional(v.string()),
    agentmailMessageId: v.optional(v.string()),
    outboundId: v.optional(v.string()),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    intendedRecipient: v.optional(v.string()),
    actualRecipient: v.optional(v.string()),
    verifiedRecipientSourceId: v.optional(v.id("sources")),
    deliveryState: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("failed"),
      v.literal("received"),
    ),
    redactedSummary: v.string(),
    attachmentMetadata: v.array(
      v.object({ name: v.string(), mediaType: v.string(), size: v.number() }),
    ),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_case_id", ["caseId"])
    .index("by_outbound_id", ["outboundId"])
    .index("by_agentmail_message_id", ["agentmailMessageId"])
    .index("by_agentmail_thread_id", ["agentmailThreadId"]),

  timelineEvents: defineTable({
    caseId: v.id("cases"),
    eventType: v.string(),
    actorType: v.union(
      v.literal("system"),
      v.literal("consumer"),
      v.literal("agentmail"),
      v.literal("scheduler"),
    ),
    visibility: v.union(v.literal("public"), v.literal("private")),
    payloadVersion: v.string(),
    summary: v.string(),
    metadataJson: v.optional(v.string()),
    timestamp: v.number(),
    idempotencyKey: v.string(),
  })
    .index("by_case_and_timestamp", ["caseId", "timestamp"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  evidenceReceipts: defineTable({
    caseId: v.id("cases"),
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
  }).index("by_case_id", ["caseId"]),

  idempotencyKeys: defineTable({
    key: v.string(),
    operation: v.string(),
    caseId: v.optional(v.id("cases")),
    resultJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_created_at", ["createdAt"]),

  rateLimits: defineTable({
    scopeHash: v.string(),
    action: v.string(),
    windowStart: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_scope_action_window", ["scopeHash", "action", "windowStart"]),
});
