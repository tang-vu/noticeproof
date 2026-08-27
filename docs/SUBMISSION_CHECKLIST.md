# Submission checklist

Status is evidence-based as of 2026-08-26.

## Required delivery

- [x] Public GitHub remote configured: `https://github.com/tang-vu/noticeproof`
- [x] MIT license present
- [x] Root `hackathon.md` started and current with local evidence
- [x] Frozen `SPEC.md`, executable `PLANS.md`, and repository `AGENTS.md`
- [x] Sanitized versioned three-case fixture set
- [x] React/Vite judge-facing landing and case workflow
- [x] Official static-hosting, Firecrawl, and AgentMail components registered
- [x] Strict OpenAI Responses extraction boundary and deterministic rule engine
- [ ] Convex generated bindings and successful development push
- [ ] Real AgentMail inbound event creates one case mapping
- [ ] Real OpenAI extraction persisted after validation
- [ ] Real Firecrawl scrape/crawl with reactive progress
- [ ] Current approval transaction drives controlled AgentMail send/delivery/reply
- [ ] Production secrets/webhooks configured
- [ ] Production demo cases seeded idempotently
- [ ] Public `convex.site` URL tested incognito
- [ ] Repository changes committed and pushed
- [ ] Demo video recorded and linked (under three minutes)
- [ ] Public social post published and linked
- [ ] Exact VibeApps submission page fields reviewed and submitted

## Engineering gates

- [x] Unit suites cover transitions, URLs, verdicts, hashes, redaction, approval, and invalid structured output
- [x] Desktop/mobile Playwright coverage exists
- [x] Production Vite build succeeds
- [x] `npm run verify` passes (46 unit checks, 8 Playwright passes, 2 project-specific skips)
- [ ] Convex reviewer completed after live backend functions exist
- [ ] Duplicate/out-of-order webhook, cross-case access, crawl callback, seed idempotency, and evidence-change integration tests pass
- [ ] Logs audited for warnings, secrets, PII, unhandled errors, query/index issues

## External actions needed

1. Authenticate/configure a Convex project (the anonymous local backend binary download stalled in this environment).
2. Provide/set server-side OpenAI, Firecrawl, and AgentMail credentials plus a controlled `DEMO_VENDOR_EMAIL`.
3. Configure AgentMail and Firecrawl webhook URLs after the Convex site URL exists.
4. Approve the production deploy, repository push, social publication, and hackathon submission.
