# NoticeProof execution plan

Statuses: `pending`, `in_progress`, `blocked`, `complete`.

## Milestones

| #   | Status      | Outcome                                                                                                   | Dependencies                                                    | Validation                                                    |
| --- | ----------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 0   | complete    | Frozen contract, repository rules, ADRs, environment contract, factual hackathon log                      | Official docs and installed Convex skills                       | Documents reviewed; `git diff --check` passes                 |
| 1   | blocked     | Thin real sponsor slice through inbound → extraction → evidence → reactive UI → approved controlled send  | Convex deployment plus OpenAI, Firecrawl, AgentMail credentials | Awaiting authenticated deployment and real event evidence     |
| 2   | in_progress | Full typed schema, capability access, transitions, idempotency, append-only timeline, deterministic seeds | M0                                                              | Schema/domain tests pass; generated Convex functions blocked  |
| 3   | in_progress | Paste/upload/email intake and ClaimEnvelope v1 with bounded retry                                         | M2, OpenAI                                                      | Contract/retry tests pass; real extraction smoke blocked      |
| 4   | blocked     | CPSC control source plus Firecrawl search/scrape/durable crawl, provenance, hashes, rechecks              | M2, Firecrawl                                                   | Awaiting Convex deployment and Firecrawl credentials          |
| 5   | in_progress | Deterministic rule engine and versioned verdict/explanations                                              | M3–M4                                                           | Fixture verdicts pass; persistence/explanations remain        |
| 6   | blocked     | Version-bound approval and safe AgentMail channel switch with reply ingestion                             | M5, AgentMail                                                   | Approval rules pass; AgentMail integration awaits credentials |
| 7   | complete    | Polished accessible mobile-first Vite UI and receipt export                                               | M2–M6                                                           | Desktop/mobile/keyboard Playwright coverage passes            |
| 8   | in_progress | Threat-model controls, reviewer pass, clean verify/build/push                                             | M1–M7                                                           | Local `npm run verify` passes; live Convex review remains     |
| 9   | blocked     | Production backend/static hosting, seeds, public smoke test, docs and submission package                  | Credentials/account authorization                               | Awaiting deployment and external publishing actions           |

## Current sequence

1. Finish M0 and record it in `hackathon.md`.
2. Scaffold React/Vite directly because the installed Convex quickstart emits Next.js and conflicts with the required frozen stack.
3. Install current official component packages and inspect their shipped types/examples before writing component integration code.
4. Implement the domain core and seeded reactive path first so local verification remains useful without external credentials.
5. Add each real sponsor adapter with explicit live/fixture labeling; never silently mock a live path.
6. Run review/verification after each milestone and update this plan plus `hackathon.md` from local evidence.

## Known external blockers

- A real Convex dev/prod deployment may require interactive Convex account authentication.
- Real OpenAI, Firecrawl, and AgentMail acceptance gates require server-side credentials.
- `DEMO_VENDOR_EMAIL`, AgentMail inbox/domain setup, webhook configuration, production deploy, social publishing, and final video upload require the user's controlled accounts or explicit approval.
