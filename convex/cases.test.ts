/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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

describe("Convex case boundaries", () => {
  it("seeds exactly three public fixtures idempotently", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seeds.seedDemoCases, {});
    await t.mutation(internal.seeds.seedDemoCases, {});

    const demos = await t.query(api.cases.listPublicDemos, {});
    expect(demos).toHaveLength(3);
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
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      const result = await t.query(api.cases.get, {
        publicId: created.publicId,
        capabilityToken: created.capabilityToken,
      });
      expect(result.case.currentState).toBe("VERIFICATION_FAILED_RETRYABLE");
      expect(result.case.currentVerdictCode).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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

  it("deduplicates AgentMail callbacks and stores only sanitized text", async () => {
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
    expect(result.notices).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.notices[0]?.bodyPreview).toBe("Model TEST-100 may be recalled.");
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
});
