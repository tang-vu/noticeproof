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

React 19 and Vite render a static, mobile-first SPA. Hash routes make fixture case URLs refresh-safe without a routing dependency. The finished live path will use Convex `useQuery` subscriptions; frontend polling is prohibited. Static files are atomically uploaded through `@convex-dev/static-hosting`.

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

The Vite fixture experience, strict extraction module, deterministic verifier, schema, registered components, and local tests are implemented. Convex generated bindings, live wrappers, seed mutation, and deployed runtime proof are not complete because a Convex project has not yet been configured; the local backend binary download repeatedly stalled. This boundary is intentional and visible rather than replaced by a fake live adapter.
