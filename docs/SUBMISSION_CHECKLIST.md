# Submission checklist

Status is evidence-based as of 2026-08-29.

## Required delivery

- [x] Public GitHub remote configured: `https://github.com/tang-vu/noticeproof`
- [x] MIT license present
- [x] Root `hackathon.md` started and current with local evidence
- [x] Frozen `SPEC.md`, executable `PLANS.md`, and repository `AGENTS.md`
- [x] Sanitized versioned three-case fixture set
- [x] React/Vite judge-facing landing and case workflow
- [x] Private screenshot upload through Convex storage with bounded metadata and retention cleanup
- [x] Official static-hosting, Firecrawl, and AgentMail components registered
- [x] Strict OpenAI Responses extraction boundary and deterministic rule engine
- [x] Convex generated bindings and successful development push
- [ ] Real AgentMail inbound event creates one case mapping
- [x] Real OpenAI extraction persisted after validation
- [x] Real Firecrawl scrape/crawl with reactive progress
- [x] Current approval transaction drives controlled AgentMail send and delivery
- [ ] Real AgentMail reply attaches to the existing trusted thread
- [ ] Production secrets/webhooks configured
- [ ] Production demo cases seeded idempotently
- [x] Public development `convex.site` URL tested externally
- [x] Repository changes committed and pushed to `main`
- [ ] Demo video recorded and linked (under three minutes)
- [ ] Public social post published and linked
- [ ] Exact VibeApps submission page fields reviewed and submitted

## Engineering gates

- [x] Unit suites cover transitions, URLs, verdicts, hashes, redaction, approval, and invalid structured output
- [x] Desktop/mobile Playwright coverage exists
- [x] Production Vite build succeeds
- [x] Final `npm run verify` passes: 60 unit/integration checks, production build, and 8 Playwright passes (2 project-specific skips)
- [x] Convex reviewer completed after live backend functions exist
- [x] Duplicate webhook, cross-case access, seed idempotency, retention, missing-key, and evidence-change tests pass
- [x] Local diff, dependency audit, secret-pattern scan, and Convex query/index patterns reviewed

## External actions needed

1. Forward one sanitized notice to the configured AgentMail inbox and reply once to the controlled outbound thread.
2. Grant fresh production-deploy consent after production secrets are ready.
3. Approve the production deploy, social publication, and hackathon submission.
