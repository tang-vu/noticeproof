import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { VERDICT_CODES } from "../shared/domain/constants";

type VerdictCode = (typeof VERDICT_CODES)[number];

type Fixture = {
  fixtureVersion: string;
  publicId: string;
  subject: string;
  sender: string;
  preview: string;
  verdict: VerdictCode;
  risk: "low" | "medium" | "high" | "unknown";
  nextAction: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceDomain: string;
  ruleId: string;
  verifiedEmail?: string;
};

const FIXTURES: Fixture[] = [
  {
    fixtureVersion: "noticeproof-fixtures/1.0.0",
    publicId: "demo-synthetic-conflict",
    subject: "URGENT: verify your account for an immediate recall refund",
    sender: "Recall Center <refunds@recall-login.example>",
    preview: "Synthetic fixture requesting a login and one-time code through an unverified domain.",
    verdict: "CONFLICTING_NOTICE",
    risk: "high",
    nextAction: "Do not use the notice link or disclose credentials.",
    sourceUrl: "https://www.cpsc.gov/Recalls",
    sourceTitle: "CPSC recalls control search",
    sourceDomain: "cpsc.gov",
    ruleId: "NP-SENSITIVE-001",
  },
  {
    fixtureVersion: "noticeproof-fixtures/1.0.1",
    publicId: "demo-real-recall-unsafe-channel",
    subject: "Paris Hilton mini fridge safety recall — act today",
    sender: "Recall Processing <refunds@epoca-recall-help.example>",
    preview: "The recall is real, but the notice substitutes an unverified claim destination.",
    verdict: "VERIFIED_RECALL_UNSAFE_CHANNEL",
    risk: "high",
    nextAction: "Ignore the notice link and use the independently verified recall contact.",
    sourceUrl:
      "https://www.cpsc.gov/Recalls/2025/Epoca-International-Recalls-Paris-Hilton-Mini-Beauty-Fridges-Due-to-Fire-and-Burn-Hazards",
    sourceTitle: "Epoca International Recalls Paris Hilton Mini Beauty Fridges",
    sourceDomain: "cpsc.gov",
    ruleId: "NP-CHANNEL-002",
    verifiedEmail: "recall@epoca.com",
  },
  {
    fixtureVersion: "noticeproof-fixtures/1.0.0",
    publicId: "demo-verified-official-channel",
    subject: "Shape sorter car toy recall — model MZL-038",
    sender: "Shape Sorter Recall <shapesorterrecall@gmail.com>",
    preview:
      "Exact model and batch match an official CPSC record and its listed generic-provider email.",
    verdict: "VERIFIED_OFFICIAL_CHANNEL",
    risk: "low",
    nextAction: "Review a message addressed to the contact listed by CPSC.",
    sourceUrl:
      "https://www.cpsc.gov/Recalls/2025/Deals-Oasis-Recalls-Shape-Sorter-Car-Toys-Due-to-Choking-Hazard-Violation-of-Small-Parts-Requirements-Risk-of-Serious-Injury-or-Death",
    sourceTitle: "Deals Oasis Recalls Shape Sorter Car Toys",
    sourceDomain: "cpsc.gov",
    ruleId: "NP-CONTACT-001",
    verifiedEmail: "shapesorterrecall@gmail.com",
  },
];

async function seedFixture(ctx: MutationCtx, fixture: Fixture, now: number): Promise<Id<"cases">> {
  const existing = await ctx.db
    .query("cases")
    .withIndex("by_public_id", (q) => q.eq("publicId", fixture.publicId))
    .unique();
  if (existing) {
    if (existing.fixtureVersion !== fixture.fixtureVersion) {
      await ctx.db.patch(existing._id, {
        fixtureVersion: fixture.fixtureVersion,
        updatedAt: now,
      });
    }
    return existing._id;
  }

  const caseId = await ctx.db.insert("cases", {
    publicId: fixture.publicId,
    capabilityHash: "public-fixture-no-capability",
    inputKind: "seeded_demo",
    currentState: "ACTIONABLE",
    currentVerdictCode: fixture.verdict,
    riskLevel: fixture.risk,
    nextAction: fixture.nextAction,
    currentVerdictVersion: 1,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 365 * 24 * 60 * 60 * 1000,
    lastCheckedAt: now,
    isDemo: true,
    isPublicFixture: true,
    fixtureVersion: fixture.fixtureVersion,
  });
  await ctx.db.insert("notices", {
    caseId,
    subject: fixture.subject,
    sender: fixture.sender,
    bodyPreview: fixture.preview,
    attachmentMetadata: [],
    canonicalNoticeHash: `fixture:${fixture.publicId}:v1`,
    createdAt: now,
  });
  const sourceId = await ctx.db.insert("sources", {
    caseId,
    canonicalUrl: fixture.sourceUrl,
    canonicalDomain: fixture.sourceDomain,
    sourceType: "cpsc_record",
    authorityTier: 1,
    fetchedAt: now,
    status: "complete",
    title: fixture.sourceTitle,
    contentHash: `fixture:${fixture.publicId}:source:v1`,
    truncated: false,
    extractionStatus: "valid",
    verifiesContact: fixture.verdict !== "CONFLICTING_NOTICE",
    ...(fixture.verifiedEmail ? { verifiedEmail: fixture.verifiedEmail } : {}),
    createdAt: now,
  });
  await ctx.db.insert("verdicts", {
    caseId,
    version: 1,
    code: fixture.verdict,
    ruleEngineVersion: "noticeproof-rules/1.0.0",
    summary: fixture.nextAction,
    missingIdentifiers: [],
    eligibleActions: fixture.verdict === "CONFLICTING_NOTICE" ? [] : ["contact_verified_email"],
    blockingReasons:
      fixture.verdict === "CONFLICTING_NOTICE"
        ? ["Sensitive request through an unverified channel"]
        : [],
    claimEnvelopeHash: `fixture:${fixture.publicId}:claims:v1`,
    evidenceManifestHash: `fixture:${fixture.publicId}:evidence:v1`,
    ruleResults: [{ ruleId: fixture.ruleId, outcome: "pass", evidenceIds: [sourceId] }],
    createdAt: now,
  });
  await ctx.db.insert("timelineEvents", {
    caseId,
    eventType: "fixture.seeded",
    actorType: "system",
    visibility: "public",
    payloadVersion: "1",
    summary: "A sanitized, versioned demonstration case was loaded.",
    timestamp: now,
    idempotencyKey: `fixture:${fixture.publicId}:seed:v1`,
  });
  return caseId;
}

export const seedDemoCases = internalMutation({
  args: {},
  returns: v.object({ createdOrExisting: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    for (const fixture of FIXTURES) await seedFixture(ctx, fixture, now);
    return { createdOrExisting: FIXTURES.length };
  },
});
