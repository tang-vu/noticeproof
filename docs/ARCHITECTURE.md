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

The production deployment serves the Vite app publicly, seeds fixtures idempotently, and has passed a fresh-browser smoke test plus a signed AgentMail intake through OpenAI extraction, Firecrawl-backed Tier 1 evidence, and a deterministic unsafe-channel verdict. The development deployment additionally records the controlled-delivery proof: a version-bound approval delivered to the visibly separate demo destination, and signed replies attached to the trusted thread. Production has its own enabled, inbox-scoped AgentMail webhook and secret; unsigned requests are rejected. Signed delivery webhooks and a bounded scheduled reconciler update the Convex communication timeline.

`@agentmail/convex@0.1.0` predates Convex component environment declarations. A checked-in `patch-package` compatibility patch declares and maps only the two component-owned AgentMail secrets; `npm ci` reapplies it deterministically. Secrets remain in deployment environment storage and never enter the browser bundle.
