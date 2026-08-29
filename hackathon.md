# Hackathon log

- **Project:** NoticeProof
- **Event:** Convex All Gas Hackathon sponsored by OpenAI, Firecrawl, and AgentMail
- **What it does:** Verifies the claims in a suspicious recall notice against authoritative evidence and switches the consumer to an independently verified contact channel.
- **Live app:** https://outgoing-snake-653.convex.site (development)
- **Repo:** https://github.com/tang-vu/noticeproof
- **Frontend:** Convex static hosting
- **Convex deployment:** https://outgoing-snake-653.convex.cloud (development)
- **Components:** @convex-dev/static-hosting, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, file storage, realtime queries
- **Auth:** none
- **AI models:** gpt-5-mini (configurable with `OPENAI_MODEL`)
- **Started:** 2026-08-26T14:18:38Z
- **Last updated:** 2026-08-29T17:15:39+07:00

## Log

### 2026-08-26 - 6e6df37

Froze the MVP contract and built the first judge-facing workflow: three labeled sanitized cases show claim normalization, authority-tier evidence, deterministic verdict rules, safe-action review, and JSON receipt export in a responsive Vite UI. Registered the static-hosting, Firecrawl, and AgentMail components; added the indexed application schema and a strict OpenAI Responses extraction boundary; and added unit plus Playwright coverage (`convex/`, `shared/`, `fixtures/v1/`, `src/`, `tests/`). `npm run verify` passes with 46 unit checks, a production build, and 8 Playwright passes with 2 project-specific skips; `npm audit --omit=dev` reports 0 vulnerabilities after updating DOMPurify. Convex code generation cannot proceed until an authenticated cloud deployment is selected (the anonymous local backend download did not complete), so the app is not deployed and no live sponsor API call is claimed yet.

### 2026-08-27 - e1a7d63

Provisioned the Convex development deployment, pushed the application schema and official components, and seeded three sanitized cases idempotently. Added capability-scoped case queries, bounded public intake, realtime React subscription, and an internal Firecrawl action; a live CPSC scrape returned 12,648 Markdown characters and content hash `23248da42f616cbd3b218b48c7f2bd40a29fab14bf2488fbedf97fb70caca5b0`, which was persisted with provenance and an idempotent timeline event (`convex/cases.ts`, `convex/seeds.ts`, `convex/firecrawl.ts`, `src/LiveDeploymentStatus.tsx`). Convex push and 49 tests pass. OpenAI and AgentMail have not yet been exercised live, and no public frontend is deployed.

### 2026-08-28 - e1a7d63

Published the development frontend through Convex static hosting and externally verified the homepage and health route. Added private live intake, scheduled schema-constrained extraction with retryable failure semantics, verified-recipient approval binding, durable AgentMail send/webhook adapters, retention cleanup cron, and read-only public fixtures. Firecrawl followed the manufacturer URL directly linked by CPSC, completed a bounded durable crawl with one stored page and one credit, and exposes reactive progress in the landing UI (`convex/approvals.ts`, `convex/email.ts`, `convex/extraction.ts`, `convex/firecrawl.ts`, `convex/maintenance.ts`, `src/LiveApp.tsx`). The final local gate passes with 56 unit/integration checks, a production build, and 8 Playwright passes with 2 project-specific skips; the production dependency audit reports 0 vulnerabilities. OpenAI and AgentMail have not yet been exercised live because their deployment credentials are not configured.

### 2026-08-29 - a2f8034

Closed the live-path gaps after an acceptance-gate audit. Screenshot intake now uploads privately to Convex storage with server-side media/size checks and scheduled retention cleanup. Validated OpenAI extraction schedules an evidence pipeline that uses Firecrawl search only for discovery, accepts only canonical CPSC recall pages as Tier 1, scrapes them, exact-matches recall/product identifiers and channels, creates evidence edges, and persists an append-only deterministic verdict. The capability-scoped UI now renders the resulting claim ledger, source hashes, rule IDs, editable outbound draft, immutable preview, and approve/cancel controls through realtime subscriptions (`convex/evidencePipeline.ts`, `convex/cases.ts`, `convex/approvals.ts`, `src/LiveApp.tsx`). `npm run verify` passes with 59 unit/integration checks, a production build, and 8 Playwright passes with 2 project-specific skips. A hosted browser smoke test uploaded a sanitized PNG, created a private capability case, and reached `VERIFICATION_FAILED_RETRYABLE` with the explicit message that extraction could not complete—correct fail-safe behavior while `OPENAI_API_KEY` is absent. OpenAI and AgentMail live proof remains credential-blocked and is not claimed.

### 2026-08-29 - working tree

Exercised OpenAI Responses extraction live on the hosted development app with sanitized pasted notices: the deployment persisted schema-validated `gpt-5-mini` ClaimEnvelopes and streamed extraction/evidence/verdict state through Convex subscriptions. During evidence review, corrected the hero fixture from CPSC recall `25-452` to the official record `25-459` and replaced a package-volume description with exact model `PZB02-E001` (`fixtures/v1/real-recall-unsafe-channel.json`, `convex/seeds.ts`). The reproducible hosted-browser proof then produced five material claims, one Tier 1 CPSC source, deterministic verdict `VERIFIED_RECALL_UNSAFE_CHANNEL`, and a safe-action draft addressed to the independently listed `recall@epoca.com`; upstream OpenAI/Firecrawl latency was about two minutes in this run and is not represented as sub-minute. Added `npm run proof:live -- <convex.site URL>` to repeat that assertion without exposing secrets. The final local gate passes with 59 unit/integration checks, a production build, and 8 Playwright passes with 2 project-specific skips; `npm audit --omit=dev` reports zero vulnerabilities. AgentMail has not been exercised live and remains the outstanding sponsor gate.
