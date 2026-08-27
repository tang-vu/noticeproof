# Hackathon log

- **Project:** NoticeProof
- **Event:** Convex All Gas Hackathon sponsored by OpenAI, Firecrawl, and AgentMail
- **What it does:** Verifies the claims in a suspicious recall notice against authoritative evidence and switches the consumer to an independently verified contact channel.
- **Live app:** not deployed
- **Repo:** https://github.com/tang-vu/noticeproof
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** schema, tables, indexes
- **Auth:** none
- **AI models:** gpt-5-mini (configurable with `OPENAI_MODEL`)
- **Started:** 2026-08-26T14:18:38Z
- **Last updated:** 2026-08-26T15:21:46Z

## Log

### 2026-08-26 - working tree

Froze the MVP contract and built the first judge-facing workflow: three labeled sanitized cases show claim normalization, authority-tier evidence, deterministic verdict rules, safe-action review, and JSON receipt export in a responsive Vite UI. Registered the static-hosting, Firecrawl, and AgentMail components; added the indexed application schema and a strict OpenAI Responses extraction boundary; and added unit plus Playwright coverage (`convex/`, `shared/`, `fixtures/v1/`, `src/`, `tests/`). `npm run verify` passes with 46 unit checks, a production build, and 8 Playwright passes with 2 project-specific skips; `npm audit --omit=dev` reports 0 vulnerabilities after updating DOMPurify. Convex code generation cannot proceed until an authenticated cloud deployment is selected (the anonymous local backend download did not complete), so the app is not deployed and no live sponsor API call is claimed yet.
