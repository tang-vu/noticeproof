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
- [x] Real AgentMail inbound event creates one case mapping
- [x] Real OpenAI extraction persisted after validation
- [x] Real Firecrawl scrape/crawl with reactive progress
- [x] Current approval transaction drives controlled AgentMail send and delivery
- [x] Real AgentMail reply attaches to the existing trusted thread
- [x] Production secrets and inbox-scoped AgentMail webhook configured
- [x] Production demo cases seeded idempotently
- [x] Public production `convex.site` URL tested in a fresh browser context
- [x] Repository changes committed and pushed to `main`
- [ ] Demo video recorded and linked (under three minutes)
- [ ] Public social post published and linked
- [ ] Exact VibeApps submission page fields reviewed and submitted
- [x] Paste-ready social and submission copy prepared in `docs/SOCIAL_POST.md` and `docs/SUBMISSION_COPY.md`

## Engineering gates

- [x] Unit suites cover transitions, URLs, verdicts, hashes, redaction, approval, and invalid structured output
- [x] Desktop/mobile Playwright coverage exists
- [x] Automated axe audits report no serious or critical WCAG findings on landing and hero case
- [x] Production Vite build succeeds
- [x] Final `npm run verify` passes: 65 unit/integration checks, production build, and 12 Playwright passes (4 project-specific skips)
- [x] Convex reviewer completed after live backend functions exist
- [x] Duplicate webhook, cross-case access, seed idempotency, retention, missing-key, and evidence-change tests pass
- [x] Local diff, dependency audit, secret-pattern scan, and Convex query/index patterns reviewed

## External actions needed

1. Record and upload the sub-three-minute demo video.
2. Approve social publication and the final hackathon submission.
