import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { hashCanonical } from "../shared/domain/hashing";
import type { RemedyType } from "../shared/domain/constants";
import { recordIntegrationProof } from "./integrationProofs";
import { assertTransition } from "../shared/domain/stateMachine";
import { parseSafePublicUrl } from "../shared/domain/urlSafety";
import { verifyNotice } from "../shared/domain/verifier";
import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { sha256 } from "./lib/access";
import { appendEvidenceReceipt } from "./lib/receipts";

const firecrawl = new FirecrawlClient(components.firecrawl);

const acquisitionInput = v.object({
  publicId: v.string(),
  claimEnvelopeHash: v.string(),
  recallId: v.optional(v.string()),
  productName: v.optional(v.string()),
  claimedRemedyType: v.optional(
    v.union(
      v.literal("refund"),
      v.literal("repair"),
      v.literal("replace"),
      v.literal("dispose"),
      v.literal("new_instructions"),
      v.literal("unknown"),
    ),
  ),
  requestedSensitiveKinds: v.array(v.string()),
  claims: v.array(v.object({ id: v.id("claims"), type: v.string(), normalizedValue: v.string() })),
});

const evaluatedSource = v.object({
  canonicalUrl: v.string(),
  canonicalDomain: v.string(),
  title: v.string(),
  contentHash: v.string(),
  verifiedEmail: v.optional(v.string()),
  matchedClaimIds: v.array(v.id("claims")),
  contradictedClaimIds: v.array(v.id("claims")),
  excerptsByClaimJson: v.string(),
});

function canonicalCpscRecallUrl(raw: string): string | null {
  try {
    const safe = parseSafePublicUrl(raw);
    if (safe.hostname !== "cpsc.gov" && safe.hostname !== "www.cpsc.gov") return null;
    const url = new URL(safe.canonicalUrl);
    if (!url.pathname.toLowerCase().startsWith("/recalls/")) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function exactTextMatch(document: string, value: string): boolean {
  const needle = normalized(value);
  return needle.length >= 3 && normalized(document).includes(needle);
}

function excerptFor(document: string, value: string): string {
  const lowerDocument = document.toLowerCase();
  const index = lowerDocument.indexOf(value.toLowerCase());
  if (index < 0) return "Exact normalized value appears in the official CPSC record.";
  return document.slice(
    Math.max(0, index - 90),
    Math.min(document.length, index + value.length + 140),
  );
}

function emailsIn(text: string): string[] {
  return [
    ...new Set(
      (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((email) =>
        email.toLowerCase(),
      ),
    ),
  ];
}

function verifiedConsumerEmails(text: string): string[] {
  return emailsIn(text).filter((email) => {
    const index = text.toLowerCase().indexOf(email);
    const context = text.slice(Math.max(0, index - 500), index + email.length + 200);
    return /consumer contact|contact (?:the )?(?:company|firm|manufacturer)|e-?mail/i.test(context);
  });
}

function remedyTypesIn(text: string): Set<RemedyType> {
  const normalizedText = normalized(text);
  const types = new Set<RemedyType>();
  if (/\brefund(?:ed|s|ing)?\b/.test(normalizedText)) types.add("refund");
  if (/\brepair(?:ed|s|ing)?\b/.test(normalizedText)) types.add("repair");
  if (/\breplac(?:e|ed|ement|ements|ing)\b/.test(normalizedText)) types.add("replace");
  if (/\b(?:dispose|disposal|discard|destroy)\b/.test(normalizedText)) types.add("dispose");
  if (/\b(?:new|updated|revised) instructions?\b/.test(normalizedText)) {
    types.add("new_instructions");
  }
  return types;
}

export const loadAcquisitionInput = internalQuery({
  args: { caseId: v.id("cases") },
  returns: v.union(v.null(), acquisitionInput),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db.get("cases", args.caseId);
    if (!caseDocument || caseDocument.currentState !== "ACQUIRING_EVIDENCE") return null;
    const envelope = await ctx.db
      .query("claimEnvelopes")
      .withIndex("by_case_id", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .first();
    if (!envelope || envelope.validationStatus !== "valid") return null;
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_envelope_id", (q) => q.eq("claimEnvelopeId", envelope._id))
      .take(100);
    return {
      publicId: caseDocument.publicId,
      claimEnvelopeHash: envelope.contentHash,
      ...(envelope.recallId ? { recallId: envelope.recallId } : {}),
      ...(envelope.productName ? { productName: envelope.productName } : {}),
      ...(envelope.claimedRemedyType ? { claimedRemedyType: envelope.claimedRemedyType } : {}),
      requestedSensitiveKinds: envelope.requestedSensitiveKinds,
      claims: claims.map((claim) => ({
        id: claim._id,
        type: claim.claimType,
        normalizedValue: claim.normalizedValue,
      })),
    };
  },
});

export const acquireAndEvaluate = internalAction({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.evidencePipeline.loadAcquisitionInput, args);
    if (!input) return null;
    try {
      const searchTerm = input.recallId ?? input.productName;
      if (!searchTerm) {
        await ctx.runMutation(internal.evidencePipeline.persistEvaluation, {
          caseId: args.caseId,
          claimEnvelopeHash: input.claimEnvelopeHash,
          authoritativeRecallFound: false,
          exactRecallIdMatch: false,
          exactProductMatch: false,
          matchCriticalIdentifierPresent: false,
          noticeChannelMatchesVerifiedChannel: false,
          unsafeSensitiveRequest: input.requestedSensitiveKinds.length > 0,
        });
        return null;
      }

      const search = await firecrawl.search(ctx, `CPSC recall ${searchTerm}`, {
        sources: ["web"],
        includeDomains: ["cpsc.gov"],
        limit: 5,
        ignoreInvalidURLs: true,
        timeout: 20_000,
      });
      const urls = [
        ...new Set(
          (search.web ?? [])
            .map((result) =>
              typeof result.url === "string" ? canonicalCpscRecallUrl(result.url) : null,
            )
            .filter((url): url is string => Boolean(url)),
        ),
      ];

      let source: typeof evaluatedSource.type | undefined;
      let authoritativeRecallFound = false;
      let exactRecallIdMatch = false;
      let exactProductMatch = false;
      let matchCriticalIdentifierPresent = false;
      let noticeChannelMatchesVerifiedChannel = false;
      let remedyConflict = false;

      for (const url of urls.slice(0, 3)) {
        const document = await firecrawl.scrape(ctx, url, {
          formats: ["markdown"],
          onlyMainContent: true,
          maxAge: 60 * 60 * 1000,
        });
        const markdown = document.markdown ?? "";
        if (!markdown.trim()) continue;
        exactRecallIdMatch = Boolean(input.recallId && exactTextMatch(markdown, input.recallId));
        const exactNameMatch = Boolean(
          input.productName && exactTextMatch(markdown, input.productName),
        );
        authoritativeRecallFound = input.recallId ? exactRecallIdMatch : exactNameMatch;
        if (!authoritativeRecallFound) continue;

        const identifierClaims = input.claims.filter((claim) =>
          ["model", "serial", "lot", "upc"].includes(claim.type),
        );
        matchCriticalIdentifierPresent = identifierClaims.length > 0;
        exactProductMatch = identifierClaims.some((claim) =>
          exactTextMatch(markdown, claim.normalizedValue),
        );
        const officialEmails = verifiedConsumerEmails(markdown);
        const officialRemedyTypes = remedyTypesIn(markdown);
        remedyConflict = Boolean(
          input.claimedRemedyType &&
            input.claimedRemedyType !== "unknown" &&
            officialRemedyTypes.size > 0 &&
            !officialRemedyTypes.has(input.claimedRemedyType),
        );
        const noticeEmails = input.claims
          .filter((claim) => claim.type === "email")
          .map((claim) => claim.normalizedValue.toLowerCase());
        const noticeUrls = input.claims
          .filter((claim) => claim.type === "url")
          .map((claim) => claim.normalizedValue);
        const officialUrlMatch = noticeUrls.some((claimedUrl) => {
          try {
            const canonicalClaimed = parseSafePublicUrl(claimedUrl).canonicalUrl;
            return canonicalClaimed === url || markdown.includes(canonicalClaimed);
          } catch {
            return false;
          }
        });
        noticeChannelMatchesVerifiedChannel =
          noticeEmails.some((email) => officialEmails.includes(email)) || officialUrlMatch;
        const matchedClaims = input.claims.filter(
          (claim) =>
            !(remedyConflict && claim.type === "remedy") &&
            exactTextMatch(markdown, claim.normalizedValue),
        );
        const channelClaims = input.claims.filter((claim) => ["email", "url"].includes(claim.type));
        const contradictedClaims = channelClaims.filter(
          (claim) => !matchedClaims.some((matched) => matched.id === claim.id),
        );
        if (remedyConflict) {
          contradictedClaims.push(...input.claims.filter((claim) => claim.type === "remedy"));
        }
        source = {
          canonicalUrl: url,
          canonicalDomain: "cpsc.gov",
          title: (document.metadata?.title ?? "CPSC recall evidence").slice(0, 500),
          contentHash: await sha256(markdown),
          ...(officialEmails[0] ? { verifiedEmail: officialEmails[0] } : {}),
          matchedClaimIds: matchedClaims.map((claim) => claim.id),
          contradictedClaimIds: contradictedClaims.map((claim) => claim.id),
          excerptsByClaimJson: JSON.stringify(
            Object.fromEntries(
              matchedClaims.map((claim) => [claim.id, excerptFor(markdown, claim.normalizedValue)]),
            ),
          ),
        };
        break;
      }

      await ctx.runMutation(internal.evidencePipeline.persistEvaluation, {
        caseId: args.caseId,
        claimEnvelopeHash: input.claimEnvelopeHash,
        authoritativeRecallFound,
        exactRecallIdMatch,
        exactProductMatch,
        matchCriticalIdentifierPresent,
        noticeChannelMatchesVerifiedChannel,
        unsafeSensitiveRequest: input.requestedSensitiveKinds.length > 0,
        remedyConflict,
        ...(source ? { source } : {}),
      });
    } catch {
      await ctx.runMutation(internal.evidencePipeline.persistFailure, {
        caseId: args.caseId,
        claimEnvelopeHash: input.claimEnvelopeHash,
      });
    }
    return null;
  },
});

export const persistEvaluation = internalMutation({
  args: {
    caseId: v.id("cases"),
    claimEnvelopeHash: v.string(),
    authoritativeRecallFound: v.boolean(),
    exactRecallIdMatch: v.boolean(),
    exactProductMatch: v.boolean(),
    matchCriticalIdentifierPresent: v.boolean(),
    noticeChannelMatchesVerifiedChannel: v.boolean(),
    unsafeSensitiveRequest: v.boolean(),
    remedyConflict: v.optional(v.boolean()),
    source: v.optional(evaluatedSource),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db.get("cases", args.caseId);
    if (!caseDocument || caseDocument.currentState !== "ACQUIRING_EVIDENCE") return null;
    const now = Date.now();
    let sourceId: string | undefined;
    const facts: Array<{
      id: string;
      tier: 1;
      relation: "supports" | "contradicts";
      claimType: string;
      ruleId: string;
    }> = [];
    if (args.source) {
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_case_and_url", (q) =>
          q.eq("caseId", args.caseId).eq("canonicalUrl", args.source!.canonicalUrl),
        )
        .unique();
      const id = existing
        ? (await ctx.db.patch(existing._id, {
            fetchedAt: now,
            status: "complete",
            title: args.source.title,
            contentHash: args.source.contentHash,
            extractionStatus: "valid",
            verifiesContact: Boolean(args.source.verifiedEmail),
            ...(args.source.verifiedEmail ? { verifiedEmail: args.source.verifiedEmail } : {}),
          }),
          existing._id)
        : await ctx.db.insert("sources", {
            caseId: args.caseId,
            canonicalUrl: args.source.canonicalUrl,
            canonicalDomain: args.source.canonicalDomain,
            sourceType: "cpsc_record",
            authorityTier: 1,
            fetchedAt: now,
            status: "complete",
            title: args.source.title,
            contentHash: args.source.contentHash,
            truncated: false,
            extractionStatus: "valid",
            verifiesContact: Boolean(args.source.verifiedEmail),
            ...(args.source.verifiedEmail ? { verifiedEmail: args.source.verifiedEmail } : {}),
            createdAt: now,
          });
      sourceId = id;
      const excerpts = JSON.parse(args.source.excerptsByClaimJson) as Record<string, unknown>;
      for (const [relation, claimIds] of [
        ["supports", args.source.matchedClaimIds],
        ["contradicts", args.source.contradictedClaimIds],
      ] as const) {
        for (const claimId of claimIds) {
          const claim = await ctx.db.get("claims", claimId);
          if (!claim || claim.caseId !== args.caseId) continue;
          const edgeId = await ctx.db.insert("evidenceEdges", {
            caseId: args.caseId,
            claimId,
            sourceId: id,
            relation,
            matchMethod:
              relation === "supports"
                ? "exact_normalized_text"
                : claim.claimType === "remedy"
                  ? "normalized_remedy_conflict"
                  : "channel_absent",
            ruleId:
              relation === "supports"
                ? "NP-MATCH-001"
                : claim.claimType === "remedy"
                  ? "NP-REMEDY-001"
                  : "NP-CHANNEL-002",
            locator: args.source.canonicalUrl,
            excerpt:
              typeof excerpts[claimId] === "string"
                ? excerpts[claimId].slice(0, 500)
                : claim.claimType === "remedy"
                  ? "The authoritative record names a different remedy type."
                  : "The claimed channel does not appear in the authoritative record.",
            createdAt: now,
          });
          facts.push({
            id: edgeId,
            tier: 1,
            relation,
            claimType: claim.claimType,
            ruleId:
              relation === "supports"
                ? "NP-MATCH-001"
                : claim.claimType === "remedy"
                  ? "NP-REMEDY-001"
                  : "NP-CHANNEL-002",
          });
        }
      }
    }

    assertTransition(caseDocument.currentState, "EVALUATING");
    const verdict = verifyNotice({
      authoritativeRecallFound: args.authoritativeRecallFound,
      exactRecallIdMatch: args.exactRecallIdMatch,
      exactProductMatch: args.exactProductMatch,
      matchCriticalIdentifierPresent: args.matchCriticalIdentifierPresent,
      noticeChannelMatchesVerifiedChannel: args.noticeChannelMatchesVerifiedChannel,
      verifiedContactAvailable: Boolean(args.source?.verifiedEmail),
      unsafeSensitiveRequest: args.unsafeSensitiveRequest,
      remedyConflict: Boolean(args.remedyConflict),
      externalFailure: false,
      facts,
    });
    const finalState =
      verdict.code === "VERIFIED_OFFICIAL_CHANNEL" ||
      verdict.code === "VERIFIED_RECALL_UNSAFE_CHANNEL"
        ? "ACTIONABLE"
        : verdict.code === "POSSIBLE_MATCH_NEEDS_IDENTIFIER"
          ? "NEEDS_IDENTIFIER"
          : verdict.code === "CONFLICTING_NOTICE"
            ? "BLOCKED_CONFLICT"
            : "NO_AUTHORITATIVE_EVIDENCE";
    assertTransition("EVALUATING", finalState);
    const evidenceManifestHash = await hashCanonical({
      sourceId,
      contentHash: args.source?.contentHash,
      facts,
    });
    const version = caseDocument.currentVerdictVersion + 1;
    const verdictId = await ctx.db.insert("verdicts", {
      caseId: args.caseId,
      version,
      code: verdict.code,
      ruleEngineVersion: verdict.ruleEngineVersion,
      summary: verdict.blockingReasons[0] ?? "Authoritative evidence supports a safe next step.",
      missingIdentifiers: verdict.missingIdentifiers,
      eligibleActions: verdict.eligibleActions,
      blockingReasons: verdict.blockingReasons,
      claimEnvelopeHash: args.claimEnvelopeHash,
      evidenceManifestHash,
      ruleResults: verdict.rules,
      createdAt: now,
    });
    await ctx.db.patch(args.caseId, {
      currentState: finalState,
      currentVerdictCode: verdict.code,
      currentVerdictVersion: version,
      riskLevel:
        verdict.code === "CONFLICTING_NOTICE" || verdict.code === "VERIFIED_RECALL_UNSAFE_CHANNEL"
          ? "high"
          : verdict.code === "VERIFIED_OFFICIAL_CHANNEL"
            ? "low"
            : "unknown",
      nextAction: verdict.blockingReasons[0] ?? "Review the verified contact and exact payload.",
      updatedAt: now,
      lastCheckedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: args.caseId,
      eventType: "verdict.created",
      actorType: "system",
      visibility: "private",
      payloadVersion: verdict.ruleEngineVersion,
      summary: `Deterministic verification produced ${verdict.code}.`,
      timestamp: now,
      idempotencyKey: `verdict:${args.caseId}:${version}:${evidenceManifestHash}`,
    });
    await appendEvidenceReceipt(ctx, args.caseId, "verdict_created", now);
    if (args.source?.contentHash) {
      await recordIntegrationProof(ctx, {
        proofKey: "firecrawl.authority_evidence",
        sponsor: "Firecrawl",
        milestone: "Authority evidence acquired",
        detail: "An official source was fetched, normalized, and content-hashed.",
        status: "verified",
        verifiedAt: now,
      });
    }
    if (env.OPENAI_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.openaiExplanation.generate, {
        caseId: args.caseId,
        verdictId,
      });
    }
    return null;
  },
});

export const persistFailure = internalMutation({
  args: { caseId: v.id("cases"), claimEnvelopeHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db.get("cases", args.caseId);
    if (!caseDocument || caseDocument.currentState !== "ACQUIRING_EVIDENCE") return null;
    assertTransition(caseDocument.currentState, "VERIFICATION_FAILED_RETRYABLE");
    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      currentState: "VERIFICATION_FAILED_RETRYABLE",
      currentVerdictCode: "VERIFICATION_FAILED_RETRYABLE",
      nextAction:
        "Evidence acquisition failed temporarily. Retry before drawing a safety conclusion.",
      updatedAt: now,
    });
    await ctx.db.insert("timelineEvents", {
      caseId: args.caseId,
      eventType: "evidence.acquisition_failed",
      actorType: "system",
      visibility: "private",
      payloadVersion: "1",
      summary: "Authoritative evidence acquisition failed safely and can be retried.",
      metadataJson: JSON.stringify({ claimEnvelopeHash: args.claimEnvelopeHash }),
      timestamp: now,
      idempotencyKey: `evidence:${args.caseId}:failed:${now}`,
    });
    return null;
  },
});
