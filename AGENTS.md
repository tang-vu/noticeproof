# Repository instructions

## Product rule

NoticeProof verifies a particular recall notice against independently acquired authority evidence and switches the user to a verified channel. Never turn it into a generic recall feed or LLM truth classifier.

## Commands

- Install: `npm ci`
- Develop frontend: `npm run dev`
- Develop Convex: `npm run dev:convex`
- Seed sanitized demos: `npm run seed`
- Full local gate: `npm run verify`
- Browser tests: `npm run test:e2e`
- Production deploy: `npm run deploy` (requires explicit user authorization and configured Convex account/secrets)

## Architecture rules

- React + Vite + strict TypeScript. Convex is the only backend and database.
- All Convex functions live under `convex/`, use object form, explicit args/returns validators, indexes instead of filters, bounded reads, internal functions by default, and component APIs for component-owned data.
- External APIs run only in actions. Commit the authorizing mutation before scheduling a side effect. All webhooks/jobs/sends use stable idempotency keys.
- Public case access requires a capability token; store only its SHA-256 hash and scope every read/write to the case.
- OpenAI extracts/aligns/explains only. Deterministic TypeScript selects authority, verdict, recipient, and action eligibility.
- Render sanitized plain text only. Validate and canonicalize URLs; reject non-HTTP(S), credentials, private/local targets, and unsafe redirect/domain relationships.
- No secret in `VITE_*`, source, fixtures, logs, receipts, screenshots, or errors.

## Safety invariants

- No evidence ≠ safe. Missing identifiers ≠ match. Search rank ≠ authority.
- No send without verified recipient + actionable current verdict + exact immutable preview + unexpired version-bound single-use approval.
- Never reply to the suspicious sender by default or use a contact found only in the notice.
- Demo redirection is explicit in UI and logs; intended and actual recipients are separate fields.
- Raw notices/uploads are private and retention-limited; public fixtures are sanitized and labeled.

## Definition of done

All relevant tests were actually run; `npm run verify` and a Convex push pass; material Convex-reviewer findings are fixed or documented; the three fixtures match expected verdicts; real integrations are evidenced honestly; the public `convex.site` works in an incognito session; docs and `hackathon.md` match repository/runtime evidence. Never commit, push, deploy, publish, or submit without the authority granted in the current request and applicable skill boundaries.
