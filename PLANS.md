# NoticeProof execution plan

Statuses: `pending`, `in_progress`, `blocked`, `complete`.

## Milestones

| #   | Status      | Outcome                                                                                                   | Dependencies                              | Validation                                                          |
| --- | ----------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| 0   | complete    | Frozen contract, repository rules, ADRs, environment contract, factual hackathon log                      | Official docs and installed Convex skills | Documents reviewed; `git diff --check` passes                       |
| 1   | complete    | Thin real sponsor slice through inbound → extraction → evidence → reactive UI → approved controlled send  | Sponsor credentials                       | Full inbound, verdict, delivery, and reply path passed live         |
| 2   | complete    | Full typed schema, capability access, transitions, idempotency, append-only timeline, deterministic seeds | M0                                        | Functions pushed; capability/seed/webhook tests pass                |
| 3   | complete    | Paste/upload/email intake and ClaimEnvelope v1 with bounded retry                                         | M2, AgentMail                             | Paste, screenshot, and forwarded-email paths validated              |
| 4   | complete    | CPSC control source plus Firecrawl search/scrape/durable crawl, provenance, hashes, rechecks              | M2, Firecrawl                             | Live scrape and bounded durable crawl completed                     |
| 5   | complete    | Deterministic rule engine and versioned verdict/explanations                                              | M3–M4                                     | Live verdict plus bounded OpenAI explanation persisted              |
| 6   | complete    | Version-bound approval and safe AgentMail channel switch with reply ingestion                             | M5, AgentMail                             | Controlled send delivered; signed replies attached reactively       |
| 7   | complete    | Polished accessible mobile-first Vite UI and receipt export                                               | M2–M6                                     | Desktop/mobile/keyboard and axe WCAG coverage passes                |
| 8   | complete    | Threat-model controls, reviewer pass, clean verify/build/push                                             | M1–M7                                     | Verify, dependency audit, secret scan, and review pass              |
| 9   | in_progress | Production backend/static hosting, seeds, public smoke test, docs and submission package                  | Final repository push and submission      | Production, video, and social launch are public; submission remains |

## Current sequence

1. Commit and push the final video/submission documentation batch.
2. Make the two final form corrections recorded in `docs/VIBEAPPS_FORM.md`.
3. Submit the exact VibeApps form and preserve a timestamped confirmation.

## Known external blockers

- Commit `889e2ec` is deployed on production with idempotent seeds, a sanitized live OpenAI/Firecrawl/verdict/receipt proof, and clean desktop/mobile public smoke results.
- Production records signed AgentMail inbound, OpenAI extraction/explanation, Firecrawl evidence, and deterministic verdict. Controlled AgentMail delivery/reply evidence remains development-only and is labeled that way.
- Commit `1960a0d` is deployed on production. A sanitized live proof reached the expected unsafe-channel verdict and controlled AgentMail status `SENT`; delivery is not claimed.
- The QA-checked 2:44 demo is public at `https://youtu.be/KX4xkUp6Qm8`; the local 1440×810 H.264/AAC master remains reproducible and excluded from Git.
- Public LinkedIn and X launch posts are complete; final submission remains a user-controlled account action.
