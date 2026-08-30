import { v } from "convex/values";
import { assertTransition } from "../shared/domain/stateMachine";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { purgeOutboundPayload } from "./lib/outboundPayload";

const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const RECHECK_STATES = [
  "ACTIONABLE",
  "NEEDS_IDENTIFIER",
  "BLOCKED_CONFLICT",
  "NO_AUTHORITATIVE_EVIDENCE",
  "VERIFICATION_FAILED_RETRYABLE",
  "AWAITING_APPROVAL",
] as const;

export const expireApprovalsAndRawContent = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({
    approvalsExpired: v.number(),
    rawCasesPurged: v.number(),
    caseAccessRevoked: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_state_and_expires_at", (q) => q.eq("state", "pending").lt("expiresAt", now))
      .take(100);
    for (const approval of approvals) {
      await ctx.db.patch(approval._id, { state: "expired" });
      await purgeOutboundPayload(ctx, approval._id);
    }

    const expiredCases = await ctx.db
      .query("cases")
      .withIndex("by_access_revoked_and_expiry", (q) =>
        q.eq("accessRevokedAt", undefined).lt("expiresAt", now),
      )
      .take(25);
    let caseAccessRevoked = 0;
    for (const caseDocument of expiredCases) {
      if (caseDocument.isPublicFixture || caseDocument.accessRevokedAt) continue;
      await ctx.db.patch(caseDocument._id, { accessRevokedAt: now, updatedAt: now });
      caseAccessRevoked += 1;
    }

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_raw_retention", (q) => q.lt("rawRetentionUntil", now))
      .take(5);
    for (const caseDocument of cases) {
      const [notices, claims, communications] = await Promise.all([
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
          subject: "[expired by retention policy]",
          sender: "[expired by retention policy]",
          bodyPreview: "[private source content expired by retention policy]",
          sanitizedBody: "[private source content expired by retention policy]",
          rawStorageId: undefined,
          attachmentMetadata: notice.attachmentMetadata.map(({ mediaType, size }) => ({
            name: "[expired]",
            mediaType,
            size,
          })),
        });
      }
      for (const claim of claims) {
        await ctx.db.patch(claim._id, {
          rawValue: "[source quote expired]",
          sourceSpan: { ...claim.sourceSpan, quote: "[source quote expired]" },
          ...(["claimed_sender", "email", "phone", "order_number", "physical_destination"].includes(
            claim.claimType,
          )
            ? { normalizedValue: "[private value expired]" }
            : {}),
        });
      }
      for (const communication of communications) {
        if (communication.direction === "inbound") {
          await ctx.db.patch(communication._id, {
            redactedSummary: "[private inbound summary expired by retention policy]",
          });
        }
      }
      await ctx.db.patch(caseDocument._id, {
        rawContentPurgedAt: now,
        rawRetentionUntil: undefined,
        updatedAt: now,
      });
    }
    return { approvalsExpired: approvals.length, rawCasesPurged: cases.length, caseAccessRevoked };
  },
});

export const scheduleEvidenceRechecks = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ scheduled: v.number(), approvalsExpired: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const staleBefore = now - RECHECK_AFTER_MS;
    let scheduled = 0;
    let approvalsExpired = 0;

    for (const state of RECHECK_STATES) {
      const candidates = await ctx.db
        .query("cases")
        .withIndex("by_state", (q) => q.eq("currentState", state))
        .take(10);
      for (const caseDocument of candidates) {
        if (
          scheduled >= 25 ||
          caseDocument.isDemo ||
          caseDocument.isPublicFixture ||
          (caseDocument.lastCheckedAt ?? caseDocument.updatedAt) > staleBefore
        ) {
          continue;
        }
        assertTransition(caseDocument.currentState, "ACQUIRING_EVIDENCE");
        if (caseDocument.currentState === "AWAITING_APPROVAL") {
          const pending = await ctx.db
            .query("approvals")
            .withIndex("by_case_and_state", (q) =>
              q.eq("caseId", caseDocument._id).eq("state", "pending"),
            )
            .take(20);
          for (const approval of pending) {
            await ctx.db.patch(approval._id, { state: "expired" });
            await purgeOutboundPayload(ctx, approval._id);
            approvalsExpired += 1;
          }
        }
        await ctx.db.patch(caseDocument._id, {
          currentState: "ACQUIRING_EVIDENCE",
          nextAction:
            "Scheduled authoritative evidence recheck is running. Prior approval is no longer valid.",
          updatedAt: now,
        });
        await ctx.db.insert("timelineEvents", {
          caseId: caseDocument._id,
          eventType: "evidence.scheduled_recheck_started",
          actorType: "scheduler",
          visibility: "private",
          payloadVersion: "1",
          summary: "A bounded scheduled recheck started for active authoritative evidence.",
          timestamp: now,
          idempotencyKey: `evidence:scheduled-recheck:${caseDocument._id}:${Math.floor(now / RECHECK_AFTER_MS)}`,
        });
        await ctx.scheduler.runAfter(0, internal.evidencePipeline.acquireAndEvaluate, {
          caseId: caseDocument._id,
        });
        scheduled += 1;
      }
      if (scheduled >= 25) break;
    }
    return { scheduled, approvalsExpired };
  },
});

export const scheduleFollowupReminders = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ reminded: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const staleBefore = now - FOLLOW_UP_AFTER_MS;
    const candidates = await ctx.db
      .query("cases")
      .withIndex("by_state", (q) => q.eq("currentState", "AWAITING_REPLY"))
      .take(25);
    let reminded = 0;
    for (const caseDocument of candidates) {
      if (
        caseDocument.isDemo ||
        caseDocument.isPublicFixture ||
        caseDocument.updatedAt > staleBefore
      ) {
        continue;
      }
      await ctx.db.patch(caseDocument._id, {
        nextAction:
          "No reply has arrived on the verified thread. Review the official phone or retailer remedy options before following up.",
        updatedAt: now,
      });
      await ctx.db.insert("timelineEvents", {
        caseId: caseDocument._id,
        eventType: "remedy.followup_due",
        actorType: "scheduler",
        visibility: "private",
        payloadVersion: "1",
        summary: "Seven days passed without a verified-channel reply; human follow-up is due.",
        timestamp: now,
        idempotencyKey: `remedy:followup:${caseDocument._id}:${Math.floor(now / FOLLOW_UP_AFTER_MS)}`,
      });
      reminded += 1;
    }
    return { reminded };
  },
});
