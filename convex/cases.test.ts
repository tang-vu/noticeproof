/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function createActionablePrivateCase(t: TestConvex<typeof schema>) {
  const created = await t.mutation(api.cases.createPasted, {
    subject: "Verified private recall",
    sender: "sender@example.test",
    body: "Model MZL-038 batch BEDLEE220801 is subject to recall 25-237.",
  });
  const source = await t.run(async (ctx) => {
    const caseDocument = await ctx.db
      .query("cases")
      .withIndex("by_public_id", (q) => q.eq("publicId", created.publicId))
      .unique();
    if (!caseDocument) throw new Error("missing case");
    await ctx.db.patch(caseDocument._id, {
      currentState: "ACTIONABLE",
      currentVerdictCode: "VERIFIED_OFFICIAL_CHANNEL",
      currentVerdictVersion: 1,
      riskLevel: "low",
    });
    const sourceId = await ctx.db.insert("sources", {
      caseId: caseDocument._id,
      canonicalUrl: "https://www.cpsc.gov/Recalls/fixture",
      canonicalDomain: "cpsc.gov",
      sourceType: "cpsc_record",
      authorityTier: 1,
      fetchedAt: 1,
      status: "complete",
      title: "Verified CPSC fixture",
      contentHash: "old-evidence-hash",
      truncated: false,
      extractionStatus: "valid",
      verifiesContact: true,
      verifiedEmail: "shapesorterrecall@gmail.com",
      createdAt: 1,
    });
    await ctx.db.insert("verdicts", {
      caseId: caseDocument._id,
      version: 1,
      code: "VERIFIED_OFFICIAL_CHANNEL",
      ruleEngineVersion: "test",
      summary: "Verified",
      missingIdentifiers: [],
      eligibleActions: ["contact_verified_email"],
      blockingReasons: [],
      claimEnvelopeHash: "claims",
      evidenceManifestHash: "evidence-v1",
      ruleResults: [],
      createdAt: 1,
    });
    return await ctx.db.get("sources", sourceId);
  });
  if (!source) throw new Error("missing source");
  return { created, source };
}

async function createEvidenceReadyCase(t: TestConvex<typeof schema>) {
  const created = await t.mutation(api.cases.createPasted, {
    subject: "Recall 25-237",
    sender: "alerts@unsafe.example",
    body: "Shape Sorter Car model MZL-038 is recalled. Contact attacker@unsafe.example.",
  });
  const ids = await t.run(async (ctx) => {
    const caseDocument = await ctx.db
      .query("cases")
      .withIndex("by_public_id", (q) => q.eq("publicId", created.publicId))
      .unique();
    const notice = caseDocument
      ? await ctx.db
          .query("notices")
          .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
          .first()
      : null;
    if (!caseDocument || !notice) throw new Error("missing case input");
    await ctx.db.patch(caseDocument._id, { currentState: "ACQUIRING_EVIDENCE" });
    const envelopeId = await ctx.db.insert("claimEnvelopes", {
      caseId: caseDocument._id,
      noticeId: notice._id,
      schemaVersion: "claim-envelope/1.0.0",
      model: "test",
      language: "en",
      noticeType: "recall",
      productName: "Shape Sorter Car",
      recallId: "25-237",
      requestedSensitiveKinds: [],
      validationStatus: "valid",
      contentHash: "claim-envelope-hash",
      createdAt: 1,
    });
    const modelClaimId = await ctx.db.insert("claims", {
      caseId: caseDocument._id,
      claimEnvelopeId: envelopeId,
      claimType: "model",
      rawValue: "MZL-038",
      normalizedValue: "MZL-038",
      sourceSpan: { start: 0, end: 7, quote: "MZL-038" },
      confidence: 1,
      matchCritical: true,
    });
    const emailClaimId = await ctx.db.insert("claims", {
      caseId: caseDocument._id,
      claimEnvelopeId: envelopeId,
      claimType: "email",
      rawValue: "attacker@unsafe.example",
      normalizedValue: "attacker@unsafe.example",
      sourceSpan: { start: 8, end: 31, quote: "attacker@unsafe.example" },
      confidence: 1,
      matchCritical: false,
    });
    return { caseId: caseDocument._id, modelClaimId, emailClaimId };
  });
  return { created, ...ids };
}

describe("Convex case boundaries", () => {
  it("seeds exactly three public fixtures idempotently", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seeds.seedDemoCases, {});
    await t.mutation(internal.seeds.seedDemoCases, {});

    const demos = await t.query(api.cases.listPublicDemos, {});
    expect(demos).toHaveLength(3);
    expect(demos.every((demo) => !("capabilityHash" in demo))).toBe(true);
    expect(demos.every((demo) => !("forwardingCodeHash" in demo))).toBe(true);
  });

  it("exposes sponsor proof without internal keys or document identifiers", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("integrationProofs", {
        proofKey: "private-deduplication-key",
        sponsor: "OpenAI",
        milestone: "Structured extraction validated",
        detail: "A sanitized proof milestone.",
        status: "verified",
        verifiedAt: 1,
      });
    });
    const [proof] = await t.query(api.integrationProofs.listPublic, {});
    expect(proof).toEqual({
      sponsor: "OpenAI",
      milestone: "Structured extraction validated",
      detail: "A sanitized proof milestone.",
      status: "verified",
      verifiedAt: 1,
    });
    expect(proof && "proofKey" in proof).toBe(false);
    expect(proof && "_id" in proof).toBe(false);
  });

  it("keeps public fixtures immutable", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seeds.seedDemoCases, {});
    await expect(
      t.mutation(api.extraction.start, { publicId: "demo-real-recall-unsafe-channel" }),
    ).rejects.toThrow("PUBLIC_FIXTURE_READ_ONLY");
  });

  it("turns a missing OpenAI credential into a retryable system state", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const created = await t.mutation(api.cases.createPasted, {
        subject: "Extraction boundary",
        sender: "sender@example.test",
        body: "Model TEST-500 may be recalled.",
      });
      await t.mutation(api.extraction.start, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const result = await t.query(api.cases.get, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
      });
      expect(result.case.currentState).toBe("VERIFICATION_FAILED_RETRYABLE");
      expect(result.case.currentVerdictCode).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it("persists a deterministic unsafe-channel verdict from exact CPSC evidence", async () => {
    const t = convexTest(schema, modules);
    const evidenceCase = await createEvidenceReadyCase(t);
    await t.mutation(internal.evidencePipeline.persistEvaluation, {
      caseId: evidenceCase.caseId,
      claimEnvelopeHash: "claim-envelope-hash",
      authoritativeRecallFound: true,
      exactRecallIdMatch: true,
      exactProductMatch: true,
      matchCriticalIdentifierPresent: true,
      noticeChannelMatchesVerifiedChannel: false,
      unsafeSensitiveRequest: false,
      source: {
        canonicalUrl: "https://www.cpsc.gov/Recalls/2025/fixture",
        canonicalDomain: "cpsc.gov",
        title: "Official CPSC fixture",
        contentHash: "official-content-hash",
        verifiedEmail: "shapesorterrecall@gmail.com",
        matchedClaimIds: [evidenceCase.modelClaimId],
        contradictedClaimIds: [evidenceCase.emailClaimId],
        excerptsByClaimJson: JSON.stringify({
          [evidenceCase.modelClaimId]: "The recalled model is MZL-038.",
        }),
      },
    });

    const result = await t.query(api.cases.get, {
      publicId: evidenceCase.created.publicId,
      capabilityToken: evidenceCase.created.capabilityToken,
    });
    expect(result.case.currentState).toBe("ACTIONABLE");
    expect(result.case.currentVerdictCode).toBe("VERIFIED_RECALL_UNSAFE_CHANNEL");
    expect(result.verdicts[0]?.ruleResults.map((rule) => rule.ruleId)).toContain("NP-CHANNEL-002");
    expect(result.sources[0]?.verifiedEmail).toBe("shapesorterrecall@gmail.com");
    expect(result.evidenceReceipts).toHaveLength(1);
    const receipt = result.evidenceReceipts.at(0);
    if (!receipt) throw new Error("receipt missing");
    expect(receipt.verdictHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.timelineHash).toMatch(/^[a-f0-9]{64}$/);
    const machineReceipt = JSON.parse(receipt.machineJson) as Record<string, unknown>;
    expect(machineReceipt).toMatchObject({
      receiptVersion: "evidence-receipt/1.0.0",
      stage: "verdict_created",
      publicCaseId: evidenceCase.created.publicId,
      verdictVersion: 1,
    });
    expect(receipt.machineJson).not.toContain("attacker@unsafe.example");
  });

  it("never turns an empty authority result into safe", async () => {
    const t = convexTest(schema, modules);
    const evidenceCase = await createEvidenceReadyCase(t);
    await t.mutation(internal.evidencePipeline.persistEvaluation, {
      caseId: evidenceCase.caseId,
      claimEnvelopeHash: "claim-envelope-hash",
      authoritativeRecallFound: false,
      exactRecallIdMatch: false,
      exactProductMatch: false,
      matchCriticalIdentifierPresent: true,
      noticeChannelMatchesVerifiedChannel: false,
      unsafeSensitiveRequest: false,
    });
    const result = await t.query(api.cases.get, {
      publicId: evidenceCase.created.publicId,
      capabilityToken: evidenceCase.created.capabilityToken,
    });
    expect(result.case.currentState).toBe("NO_AUTHORITATIVE_EVIDENCE");
    expect(result.case.currentVerdictCode).toBe("NO_AUTHORITATIVE_EVIDENCE");
    expect(result.case.riskLevel).toBe("unknown");
  });

  it("binds an approval to an authoritative contact and immutable payload", async () => {
    const t = convexTest(schema, modules);
    const { created, source } = await createActionablePrivateCase(t);

    const draft = await t.mutation(api.approvals.createDraft, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
      verifiedRecipientSourceId: source._id,
      intendedRecipient: "shapesorterrecall@gmail.com",
      subject: "Requesting recall remedy instructions",
      body: "Please confirm the next step for model MZL-038, batch BEDLEE220801.",
    });
    expect(draft.intendedRecipient).toBe("shapesorterrecall@gmail.com");
    expect(draft.payloadHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      t.mutation(api.approvals.approveAndSend, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
        approvalId: draft.approvalId,
        payloadHash: draft.payloadHash,
      }),
    ).rejects.toThrow("AGENTMAIL_INBOX_ID_NOT_CONFIGURED");

    const approval = await t.run(async (ctx) => await ctx.db.get("approvals", draft.approvalId));
    expect(approval?.state).toBe("pending");

    await t.mutation(api.approvals.rejectDraft, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
      approvalId: draft.approvalId,
    });
    const rejected = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(rejected.case.currentState).toBe("ACTIONABLE");
    expect(rejected.approvals[0]?.state).toBe("rejected");
  });

  it("blocks an unverified recipient and sensitive outbound payload", async () => {
    const t = convexTest(schema, modules);
    const { created, source } = await createActionablePrivateCase(t);

    await expect(
      t.mutation(api.approvals.createDraft, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
        verifiedRecipientSourceId: source._id,
        intendedRecipient: "attacker@example.test",
        subject: "Recall request",
        body: "Please provide the remedy instructions.",
      }),
    ).rejects.toThrow("RECIPIENT_SOURCE_MISMATCH");

    await expect(
      t.mutation(api.approvals.createDraft, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
        verifiedRecipientSourceId: source._id,
        intendedRecipient: "shapesorterrecall@gmail.com",
        subject: "Recall request",
        body: "My password is hunter2 and my one-time code is 123456.",
      }),
    ).rejects.toThrow("PAYLOAD_BLOCKED");
  });

  it("invalidates a pending approval when authoritative evidence changes", async () => {
    const t = convexTest(schema, modules);
    const { created, source } = await createActionablePrivateCase(t);
    const draft = await t.mutation(api.approvals.createDraft, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
      verifiedRecipientSourceId: source._id,
      intendedRecipient: "shapesorterrecall@gmail.com",
      subject: "Recall request",
      body: "Please confirm the remedy instructions.",
    });

    await t.mutation(internal.firecrawl.persistCpscEvidence, {
      publicId: created.publicId,
      canonicalUrl: source.canonicalUrl,
      title: source.title,
      contentHash: "new-evidence-hash",
    });
    const result = await t.run(async (ctx) => ({
      approval: await ctx.db.get("approvals", draft.approvalId),
      caseDocument: await ctx.db
        .query("cases")
        .withIndex("by_public_id", (q) => q.eq("publicId", created.publicId))
        .unique(),
    }));
    expect(result.approval?.state).toBe("expired");
    expect(result.caseDocument?.currentState).toBe("ACQUIRING_EVIDENCE");
  });

  it("schedules bounded stale evidence rechecks and expires prior approval", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const { created, source } = await createActionablePrivateCase(t);
      const draft = await t.mutation(api.approvals.createDraft, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
        verifiedRecipientSourceId: source._id,
        intendedRecipient: "shapesorterrecall@gmail.com",
        subject: "Recall request",
        body: "Please confirm the remedy instructions.",
      });
      const result = await t.mutation(internal.maintenance.scheduleEvidenceRechecks, {
        now: Date.now() + 25 * 60 * 60 * 1000,
      });
      expect(result).toEqual({ scheduled: 1, approvalsExpired: 1 });
      const bundle = await t.query(api.cases.get, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
      });
      expect(bundle.case.currentState).toBe("ACQUIRING_EVIDENCE");
      expect(bundle.approvals.find((approval) => approval._id === draft.approvalId)?.state).toBe(
        "expired",
      );
      expect(bundle.timeline[0]?.eventType).toBe("evidence.scheduled_recheck_started");
      expect(
        await t.mutation(internal.maintenance.scheduleEvidenceRechecks, {
          now: Date.now() + 25 * 60 * 60 * 1000,
        }),
      ).toEqual({ scheduled: 0, approvalsExpired: 0 });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records human-confirmed remedy and resolution as append-only receipts", async () => {
    const t = convexTest(schema, modules);
    const evidenceCase = await createEvidenceReadyCase(t);
    await t.mutation(internal.evidencePipeline.persistEvaluation, {
      caseId: evidenceCase.caseId,
      claimEnvelopeHash: "claim-envelope-hash",
      authoritativeRecallFound: false,
      exactRecallIdMatch: false,
      exactProductMatch: false,
      matchCriticalIdentifierPresent: true,
      noticeChannelMatchesVerifiedChannel: false,
      unsafeSensitiveRequest: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(evidenceCase.caseId, { currentState: "AWAITING_REPLY" });
    });
    await expect(
      t.mutation(api.cases.updateResolution, {
        publicId: evidenceCase.created.publicId,
        capabilityToken: evidenceCase.created.capabilityToken,
        action: "confirm_remedy",
      }),
    ).resolves.toEqual({ state: "REMEDY_CONFIRMED" });
    await expect(
      t.mutation(api.cases.updateResolution, {
        publicId: evidenceCase.created.publicId,
        capabilityToken: evidenceCase.created.capabilityToken,
        action: "resolve",
      }),
    ).resolves.toEqual({ state: "RESOLVED" });
    const bundle = await t.query(api.cases.get, {
      publicId: evidenceCase.created.publicId,
      capabilityToken: evidenceCase.created.capabilityToken,
    });
    expect(bundle.case.currentState).toBe("RESOLVED");
    expect(bundle.evidenceReceipts).toHaveLength(3);
    expect(bundle.evidenceReceipts[0]?.machineJson).toContain('"stage":"case_resolved"');
  });

  it("adds one bounded follow-up reminder after seven days awaiting reply", async () => {
    const t = convexTest(schema, modules);
    const { created } = await createActionablePrivateCase(t);
    await t.run(async (ctx) => {
      const caseDocument = await ctx.db
        .query("cases")
        .withIndex("by_public_id", (q) => q.eq("publicId", created.publicId))
        .unique();
      if (!caseDocument) throw new Error("missing case");
      await ctx.db.patch(caseDocument._id, { currentState: "AWAITING_REPLY", updatedAt: 1 });
    });
    const now = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(await t.mutation(internal.maintenance.scheduleFollowupReminders, { now })).toEqual({
      reminded: 1,
    });
    expect(await t.mutation(internal.maintenance.scheduleFollowupReminders, { now })).toEqual({
      reminded: 0,
    });
    const bundle = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(bundle.timeline[0]?.eventType).toBe("remedy.followup_due");
  });

  it("requires the exact capability for a private case", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.cases.createPasted, {
      subject: "Possible recall",
      sender: "sender@example.test",
      body: "Model TEST-100 may be recalled.",
    });

    await expect(
      t.query(api.cases.get, {
        publicId: created.publicId,
        capabilityToken: "incorrect-capability",
      }),
    ).rejects.toThrow("CASE_ACCESS_DENIED");

    const result = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(result.case.publicId).toBe(created.publicId);
    expect(result.notices).toHaveLength(1);
  });

  it("deduplicates identical pasted notices", async () => {
    const t = convexTest(schema, modules);
    const notice = {
      subject: "Recall",
      sender: "sender@example.test",
      body: "A unique notice body for deterministic deduplication.",
    };
    await t.mutation(api.cases.createPasted, notice);
    await expect(t.mutation(api.cases.createPasted, notice)).rejects.toThrow("DUPLICATE_NOTICE");
  });

  it("stores an uploaded screenshot privately with bounded metadata", async () => {
    const t = convexTest(schema, modules);
    const image = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(image));
    const created = await t.mutation(api.cases.createScreenshot, {
      storageId,
      fileName: "recall.png",
      mediaType: "image/png",
      size: image.size,
    });
    const result = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(result.case.inputKind).toBe("screenshot");
    expect(result.notices[0]?.rawStorageId).toBe(storageId);
    expect(result.notices[0]?.attachmentMetadata[0]?.name).toBe("recall.png");
  });

  it("attaches a forwarded message to its one-time capability-scoped session", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.cases.createForwardingSession, {});
    await t.mutation(internal.email.onMessageReceived, {
      eventId: "evt_tracked_forward",
      thread: { thread_id: "thread_tracked" },
      message: {
        message_id: "message_tracked",
        inbox_id: "noticeproof@agentmail.to",
        thread_id: "thread_tracked",
        from: "Consumer <consumer@example.test>",
        subject: created.forwardingSubject,
        extracted_text: "Model TEST-TRACKED may be recalled.",
      },
    });

    const result = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(result.case.forwardingClaimedAt).toBeTypeOf("number");
    expect(result.case.currentState).toBe("EXTRACTING_CLAIMS");
    expect(result.notices).toHaveLength(1);
    expect(result.notices[0]?.agentmailInboundId).toBe("message_tracked");
  });

  it("does not cross-attach or reuse one-time forwarding sessions", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.cases.createForwardingSession, {});
    const second = await t.mutation(api.cases.createForwardingSession, {});
    const message = {
      inbox_id: "noticeproof@agentmail.to",
      from: "Consumer <consumer@example.test>",
      subject: second.forwardingSubject,
      extracted_text: "Model SECOND-ONLY may be recalled.",
    };
    await t.mutation(internal.email.onMessageReceived, {
      eventId: "evt_second_session",
      thread: { thread_id: "thread_second" },
      message: {
        ...message,
        message_id: "message_second",
        thread_id: "thread_second",
      },
    });
    await t.mutation(internal.email.onMessageReceived, {
      eventId: "evt_replay_session",
      thread: { thread_id: "thread_replay" },
      message: {
        ...message,
        message_id: "message_replay",
        thread_id: "thread_replay",
      },
    });

    const firstResult = await t.query(api.cases.get, {
      publicId: first.publicId,
      capabilityToken: first.capabilityToken,
    });
    const secondResult = await t.query(api.cases.get, {
      publicId: second.publicId,
      capabilityToken: second.capabilityToken,
    });
    const caseCount = await t.run(async (ctx) => (await ctx.db.query("cases").take(10)).length);
    expect(firstResult.notices).toHaveLength(0);
    expect(secondResult.notices).toHaveLength(1);
    expect(caseCount).toBe(2);
  });

  it("deduplicates AgentMail callbacks and stores only sanitized text", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const callback = {
      eventId: "evt_inbound_001",
      thread: { thread_id: "thread_001" },
      message: {
        message_id: "message_001",
        inbox_id: "inbox_001",
        thread_id: "thread_001",
        from: "Consumer <consumer@example.test>",
        subject: "Forwarded recall",
        extracted_text: "<script>ignore()</script>Model TEST-100 may be recalled.",
      },
    };
    await t.mutation(internal.email.onMessageReceived, callback);
    await t.mutation(internal.email.onMessageReceived, callback);

    const result = await t.run(async (ctx) => ({
      cases: await ctx.db.query("cases").take(10),
      notices: await ctx.db.query("notices").take(10),
      events: await ctx.db.query("timelineEvents").take(10),
    }));
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]?.currentState).toBe("EXTRACTING_CLAIMS");
    expect(result.notices).toHaveLength(1);
    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.eventType)).toContain("claims.extraction_started");
    expect(result.notices[0]?.bodyPreview).toBe("Model TEST-100 may be recalled.");
  });

  it("attaches an AgentMail reply to the existing trusted thread", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(internal.email.onMessageReceived, {
      eventId: "evt_thread_first",
      thread: { thread_id: "thread_shared" },
      message: {
        message_id: "message_first",
        inbox_id: "noticeproof@agentmail.to",
        thread_id: "thread_shared",
        from: "Consumer <consumer@example.test>",
        subject: "Forwarded recall",
        extracted_text: "Model TEST-100 may be recalled.",
      },
    });
    await t.mutation(internal.email.onMessageReceived, {
      eventId: "evt_thread_reply",
      thread: { thread_id: "thread_shared" },
      message: {
        message_id: "message_reply",
        inbox_id: "noticeproof@agentmail.to",
        thread_id: "thread_shared",
        from: "Controlled vendor <vendor@example.test>",
        subject: "Re: Forwarded recall",
        extracted_text: "Controlled remedy reply received.",
      },
    });

    const result = await t.run(async (ctx) => ({
      cases: await ctx.db.query("cases").take(10),
      notices: await ctx.db.query("notices").take(10),
      communications: await ctx.db.query("communications").take(10),
      events: await ctx.db.query("timelineEvents").take(10),
    }));
    expect(result.cases).toHaveLength(1);
    expect(result.notices).toHaveLength(1);
    expect(result.communications).toHaveLength(2);
    expect(result.events.map((event) => event.eventType)).toContain("agentmail.reply_received");
  });

  it("expires approvals and purges retained notice content in bounded maintenance", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.cases.createPasted, {
      subject: "Retention test",
      sender: "sender@example.test",
      body: "Private retained notice content.",
    });
    await t.run(async (ctx) => {
      const caseDocument = await ctx.db
        .query("cases")
        .withIndex("by_public_id", (q) => q.eq("publicId", created.publicId))
        .unique();
      if (!caseDocument) throw new Error("missing case");
      await ctx.db.patch(caseDocument._id, { rawRetentionUntil: 1 });
    });

    const result = await t.mutation(internal.maintenance.expireApprovalsAndRawContent, { now: 2 });
    expect(result.rawCasesPurged).toBe(1);
    const caseBundle = await t.query(api.cases.get, {
      publicId: created.publicId,
      capabilityToken: created.capabilityToken,
    });
    expect(caseBundle.notices[0]?.sanitizedBody).toBe("[expired by retention policy]");
  });

  it("revokes private capability access after case expiry", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.cases.createPasted, {
      subject: "Expiry test",
      sender: "sender@example.test",
      body: "A private notice that must not outlive its case capability.",
    });
    const maintenance = await t.mutation(internal.maintenance.expireApprovalsAndRawContent, {
      now: Date.now() + 31 * 24 * 60 * 60 * 1000,
    });
    expect(maintenance.caseAccessRevoked).toBe(1);
    await expect(
      t.query(api.cases.get, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
      }),
    ).rejects.toThrow("CASE_EXPIRED");
  });
});
