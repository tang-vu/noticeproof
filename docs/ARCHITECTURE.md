# Architecture

## Shape

```text
Paste / image / AgentMail forward
              │
              ▼
   Convex intake transaction ── private storage + idempotent timeline
              │
              ▼
 OpenAI strict ClaimEnvelope ── validated, versioned, source-spanned claims
              │
              ▼
 CPSC API control source + Firecrawl search/scrape/durable bounded crawl
              │                    │
              │                    └─ reactive component progress/pages
              ▼
 Deterministic authority graph + rule engine
              │
       append-only verdict
              │
     ┌────────┴────────┐
 clarification/block  actionable → immutable preview → approval transaction
                                                  │
                                                  ▼
                                     AgentMail durable new thread
                                                  │
                                                  ▼
                                  reactive delivery/reply/timeline/receipt
```

## Frontend

React 19 and Vite render a static, mobile-first SPA. Hash routes make fixture and capability case URLs refresh-safe without a routing dependency. The live path uses Convex `useQuery` subscriptions; frontend polling is prohibited. Static files are atomically uploaded through `@convex-dev/static-hosting`.

## Convex boundaries

The app schema separates cases, sanitized notice metadata, claim envelopes, normalized claims, sources, evidence edges, verdict versions, approvals, communications, timeline events, receipts, idempotency keys, and rate-limit windows. Every read path has a named index. Component-owned AgentMail and Firecrawl tables remain isolated; application tables store only stable mappings and derived product state.

Public seeded demos are explicitly allowlisted sanitized fixtures. Private cases use a 256-bit capability whose SHA-256 hash is stored; the secret is not placed in server-visible paths or logs. Full authentication is intentionally deferred to preserve a zero-invite public demo, not replaced with client-supplied identity.

## Side-effect ordering

1. Validate capability, current state, verdict/evidence versions, recipient authority, limits, and idempotency key.
2. Commit the authorizing transition/approval consumption transaction.
3. Schedule only an internal action.
4. Append outcome events idempotently; converge out-of-order delivery events by monotonic status rules.

No action is initiated from an LLM response. External failures select only `VERIFICATION_FAILED_RETRYABLE`.

## Current implementation status

The development deployment now serves the Vite app publicly, seeds fixtures idempotently, exposes capability-scoped realtime queries, and records a live Firecrawl scrape plus bounded durable manufacturer crawl. New text or screenshot cases schedule extraction, discover only allowlisted CPSC recall pages through Firecrawl, exact-match identifiers, persist append-only deterministic verdicts, and expose the safe-action preview/approval transaction reactively. OpenAI extraction and AgentMail webhook/send adapters are deployed with safe missing-secret behavior, but real OpenAI and AgentMail events are not claimed until those account credentials are configured.
