import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { v } from "convex/values";
import { assertTransition } from "../shared/domain/stateMachine";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { requireCaseAccess, sha256 } from "./lib/access";

const firecrawl = new FirecrawlClient(components.firecrawl);

function requireCpscUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (hostname !== "cpsc.gov" && hostname !== "www.cpsc.gov")) {
    throw new Error("FIRECRAWL_SOURCE_NOT_ALLOWLISTED");
  }
  url.hash = "";
  return url.toString();
}

export const scrapeCpscEvidence = internalAction({
  args: { publicId: v.optional(v.string()), url: v.optional(v.string()) },
  returns: v.object({
    canonicalUrl: v.string(),
    title: v.string(),
    contentHash: v.string(),
    markdownCharacters: v.number(),
    linkedManufacturerUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const publicId = args.publicId ?? "demo-real-recall-unsafe-channel";
    const canonicalUrl = requireCpscUrl(
      args.url ??
        "https://www.cpsc.gov/Recalls/2025/Epoca-International-Recalls-Paris-Hilton-Mini-Beauty-Fridges-Due-to-Fire-and-Burn-Hazards",
    );
    const document = await firecrawl.scrape(ctx, canonicalUrl, {
      formats: ["markdown", "links"],
      onlyMainContent: true,
      maxAge: 60 * 60 * 1000,
    });
    const markdown = document.markdown ?? "";
    if (!markdown.trim()) throw new Error("FIRECRAWL_EMPTY_EVIDENCE");
    const contentHash = await sha256(markdown);
    const title = document.metadata?.title ?? "CPSC recall evidence";
    const linkedManufacturerLink = document.links?.find((link) => {
      try {
        const hostname = new URL(link).hostname.toLowerCase();
        return hostname === "epoca.com" || hostname.endsWith(".epoca.com");
      } catch {
        return false;
      }
    });
    const linkedManufacturerUrl = linkedManufacturerLink
      ? (() => {
          const linked = new URL(linkedManufacturerLink);
          linked.protocol = "https:";
          linked.hash = "";
          return linked.toString();
        })()
      : undefined;
    await ctx.runMutation(internal.firecrawl.persistCpscEvidence, {
      publicId,
      canonicalUrl,
      title: title.slice(0, 500),
      contentHash,
      ...(linkedManufacturerUrl ? { linkedManufacturerUrl } : {}),
    });
    return {
      canonicalUrl,
      title,
      contentHash,
      markdownCharacters: markdown.length,
      ...(linkedManufacturerUrl ? { linkedManufacturerUrl } : {}),
    };
  },
});

export const persistCpscEvidence = internalMutation({
  args: {
    publicId: v.string(),
    canonicalUrl: v.string(),
    title: v.string(),
    contentHash: v.string(),
    linkedManufacturerUrl: v.optional(v.string()),
  },
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db
      .query("cases")
      .withIndex("by_public_id", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!caseDocument) throw new Error("CASE_NOT_FOUND");
    const now = Date.now();
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_case_and_url", (q) =>
        q.eq("caseId", caseDocument._id).eq("canonicalUrl", args.canonicalUrl),
      )
      .unique();
    const evidenceChanged = Boolean(
      existing?.contentHash && existing.contentHash !== args.contentHash,
    );
    const sourceId = existing
      ? (await ctx.db.patch(existing._id, {
          fetchedAt: now,
          status: "complete",
          title: args.title,
          contentHash: args.contentHash,
          extractionStatus: "valid",
        }),
        existing._id)
      : await ctx.db.insert("sources", {
          caseId: caseDocument._id,
          canonicalUrl: args.canonicalUrl,
          canonicalDomain: "cpsc.gov",
          sourceType: "cpsc_record",
          authorityTier: 1,
          fetchedAt: now,
          status: "complete",
          title: args.title,
          contentHash: args.contentHash,
          truncated: false,
          extractionStatus: "valid",
          verifiesContact: false,
          createdAt: now,
        });

    if (evidenceChanged) {
      const pendingApprovals = await ctx.db
        .query("approvals")
        .withIndex("by_case_and_state", (q) =>
          q.eq("caseId", caseDocument._id).eq("state", "pending"),
        )
        .take(20);
      for (const approval of pendingApprovals) {
        await ctx.db.patch(approval._id, { state: "expired" });
      }
      if (caseDocument.currentState === "AWAITING_APPROVAL") {
        assertTransition(caseDocument.currentState, "ACQUIRING_EVIDENCE");
        await ctx.db.patch(caseDocument._id, {
          currentState: "ACQUIRING_EVIDENCE",
          nextAction: "Authoritative evidence changed. Re-evaluation is required before approval.",
        });
      }
    }

    const idempotencyKey = `firecrawl:${caseDocument._id}:${args.contentHash}`;
    const priorEvent = await ctx.db
      .query("timelineEvents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (!priorEvent) {
      await ctx.db.insert("timelineEvents", {
        caseId: caseDocument._id,
        eventType: "evidence.firecrawl_scraped",
        actorType: "system",
        visibility: caseDocument.isPublicFixture ? "public" : "private",
        payloadVersion: "1",
        summary: "Firecrawl refreshed an allowlisted CPSC evidence page.",
        timestamp: now,
        idempotencyKey,
      });
    }
    if (args.linkedManufacturerUrl) {
      const linkedUrl = new URL(args.linkedManufacturerUrl);
      const hostname = linkedUrl.hostname.toLowerCase();
      if (
        linkedUrl.protocol === "https:" &&
        (hostname === "epoca.com" || hostname.endsWith(".epoca.com"))
      ) {
        linkedUrl.hash = "";
        const canonicalLinkedUrl = linkedUrl.toString();
        const linkedSource = await ctx.db
          .query("sources")
          .withIndex("by_case_and_url", (q) =>
            q.eq("caseId", caseDocument._id).eq("canonicalUrl", canonicalLinkedUrl),
          )
          .unique();
        if (!linkedSource) {
          await ctx.db.insert("sources", {
            caseId: caseDocument._id,
            canonicalUrl: canonicalLinkedUrl,
            canonicalDomain: "epoca.com",
            sourceType: "manufacturer_page",
            authorityTier: 2,
            discoveredFromSourceId: sourceId,
            fetchedAt: now,
            status: "pending",
            title: "Manufacturer page linked from CPSC evidence",
            truncated: false,
            extractionStatus: "pending",
            verifiesContact: false,
            createdAt: now,
          });
        }
      }
    }
    await ctx.db.patch(caseDocument._id, { updatedAt: now, lastCheckedAt: now });
    return sourceId;
  },
});

export const getManufacturerCrawlTarget = internalQuery({
  args: { publicId: v.string() },
  returns: v.object({ caseId: v.id("cases"), sourceId: v.id("sources"), url: v.string() }),
  handler: async (ctx, args) => {
    const caseDocument = await ctx.db
      .query("cases")
      .withIndex("by_public_id", (q) => q.eq("publicId", args.publicId))
      .unique();
    if (!caseDocument) throw new Error("CASE_NOT_FOUND");
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
      .take(50);
    const source = sources.find(
      (candidate) => candidate.authorityTier === 2 && candidate.sourceType === "manufacturer_page",
    );
    if (!source) throw new Error("NO_TIER2_MANUFACTURER_TARGET");
    return { caseId: caseDocument._id, sourceId: source._id, url: source.canonicalUrl };
  },
});

export const startManufacturerCrawl = internalAction({
  args: { publicId: v.optional(v.string()) },
  returns: v.object({ crawlId: v.string(), jobId: v.string() }),
  handler: async (ctx, args) => {
    const publicId = args.publicId ?? "demo-real-recall-unsafe-channel";
    const target: { caseId: string; sourceId: string; url: string } = await ctx.runQuery(
      internal.firecrawl.getManufacturerCrawlTarget,
      { publicId },
    );
    const result = await firecrawl.startCrawl(ctx, {
      url: target.url,
      options: {
        includePaths: ["^/minifridgerecall/?(?:.*)?$"],
        limit: 5,
        maxDiscoveryDepth: 2,
        crawlEntireDomain: false,
        allowExternalLinks: false,
        allowSubdomains: false,
        deduplicateSimilarURLs: true,
        scrapeOptions: { formats: ["markdown", "links"], onlyMainContent: true },
      },
      storeContent: true,
      onComplete: internal.firecrawl.onManufacturerCrawlComplete,
      context: { publicId, sourceId: target.sourceId },
    });
    await ctx.runMutation(internal.firecrawl.persistCrawlStarted, {
      publicId,
      sourceId: target.sourceId,
      crawlId: result.crawlId,
    });
    return result;
  },
});

export const persistCrawlStarted = internalMutation({
  args: { publicId: v.string(), sourceId: v.string(), crawlId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sourceId = ctx.db.normalizeId("sources", args.sourceId);
    if (!sourceId) throw new Error("SOURCE_ID_INVALID");
    const source = await ctx.db.get("sources", sourceId);
    if (!source) throw new Error("SOURCE_NOT_FOUND");
    const caseDocument = await ctx.db.get("cases", source.caseId);
    if (!caseDocument || caseDocument.publicId !== args.publicId)
      throw new Error("CASE_SOURCE_MISMATCH");
    const now = Date.now();
    await ctx.db.patch(source._id, { crawlId: args.crawlId, status: "crawling", fetchedAt: now });
    await ctx.db.insert("timelineEvents", {
      caseId: caseDocument._id,
      eventType: "evidence.manufacturer_crawl_started",
      actorType: "system",
      visibility: caseDocument.isPublicFixture ? "public" : "private",
      payloadVersion: "1",
      summary: "A bounded durable crawl started on a manufacturer page linked by CPSC.",
      timestamp: now,
      idempotencyKey: `firecrawl:${args.crawlId}:started`,
    });
    return null;
  },
});

export const onManufacturerCrawlComplete = internalMutation({
  // Firecrawl's callback contract carries opaque context; fields are narrowed before use.
  args: {
    crawlId: v.string(),
    jobId: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled")),
    pageCount: v.number(),
    unstored: v.optional(v.number()),
    error: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_crawl_id", (q) => q.eq("crawlId", args.crawlId))
      .unique();
    if (!source) return null;
    const caseDocument = await ctx.db.get("cases", source.caseId);
    if (!caseDocument) return null;
    const now = Date.now();
    await ctx.db.patch(source._id, {
      status: args.status === "completed" ? "complete" : "failed",
      extractionStatus: args.status === "completed" ? "pending" : "invalid",
      truncated: Boolean(args.unstored),
      fetchedAt: now,
    });
    const key = `firecrawl:${args.crawlId}:completed`;
    const existing = await ctx.db
      .query("timelineEvents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", key))
      .unique();
    if (!existing) {
      await ctx.db.insert("timelineEvents", {
        caseId: caseDocument._id,
        eventType: `evidence.manufacturer_crawl_${args.status}`,
        actorType: "system",
        visibility: caseDocument.isPublicFixture ? "public" : "private",
        payloadVersion: "1",
        summary:
          args.status === "completed"
            ? `Manufacturer crawl completed with ${args.pageCount} stored evidence pages.`
            : "Manufacturer crawl ended without producing authoritative evidence.",
        timestamp: now,
        idempotencyKey: key,
      });
    }
    return null;
  },
});

export const crawlProgress = query({
  args: { publicId: v.optional(v.string()), capabilityToken: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      crawlId: v.string(),
      status: v.string(),
      pageCount: v.number(),
      total: v.optional(v.number()),
      completed: v.optional(v.number()),
      creditsUsed: v.optional(v.number()),
      finalized: v.boolean(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const caseDocument = await requireCaseAccess(
      ctx,
      args.publicId ?? "demo-real-recall-unsafe-channel",
      args.capabilityToken,
    );
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseDocument._id))
      .take(50);
    const crawlId = sources.find((source) => source.crawlId)?.crawlId;
    if (!crawlId) return null;
    const crawl = await firecrawl.getCrawl(ctx, crawlId);
    if (!crawl) return null;
    return {
      crawlId,
      status: crawl.status,
      pageCount: crawl.pageCount,
      ...(crawl.total === undefined ? {} : { total: crawl.total }),
      ...(crawl.completed === undefined ? {} : { completed: crawl.completed }),
      ...(crawl.creditsUsed === undefined ? {} : { creditsUsed: crawl.creditsUsed }),
      finalized: crawl.finalized,
      ...(crawl.error === undefined ? {} : { error: crawl.error }),
    };
  },
});
