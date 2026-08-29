# NoticeProof product contract

Status: frozen MVP contract

Version: 1.0.0
Frozen: 2026-08-26

## Thesis

NoticeProof turns a suspicious recall notice into an evidence-backed safe next step. It treats the notice as untrusted claims, independently checks current CPSC and authority-linked manufacturer evidence, prevents action through an unverified channel, and records the remedy workflow through completion.

Tagline: **Don't click the recall. Prove it.**

## MVP scope

- United States consumer-product recalls covered by the CPSC.
- Intake by pasted text, deliberate AgentMail forwarding, screenshot, or image upload.
- A reactive case ledger: extraction, evidence acquisition, deterministic evaluation, approval, verified-channel communication, reply, and receipt.
- Three public, sanitized, versioned demo cases requiring no account or personal data.
- Email initiation only when the recipient is independently verified. Non-email remedies remain explicit human actions.

## Sponsor responsibilities

- **Convex:** system of record, capability-scoped access, state-machine transactions, component state, file storage, HTTP webhooks, schedulers, idempotency, append-only audit records, and reactive subscriptions.
- **OpenAI Responses API:** schema-constrained extraction, evidence-language alignment, clarification questions, and bounded explanations. It never chooses authority, verdict, recipient, or action eligibility.
- **Firecrawl Convex component:** search/scrape of unstructured official pages and a bounded durable manufacturer-domain crawl with reactive progress. Search rank is never authority.
- **AgentMail Convex component:** persistent inbound inbox, verified webhooks, deduplicated message/thread mapping, durable sending after approval, and reactive delivery/reply state.

## Invariants

1. Absence of authoritative evidence is never represented as safe or fake.
2. Only deterministic rules can select a verdict.
3. Every material extracted field has a source span; every persisted external/model payload is runtime-validated.
4. A contact is verified only when listed by Tier 1 evidence or Tier 2 evidence reached directly from Tier 1.
5. No external action occurs without a current actionable verdict, independently verified destination, immutable payload preview, explicit unexpired approval, and single-use consumption.
6. Evidence changes invalidate pending approvals before sending.
7. Demo mode visibly redirects to `DEMO_VENDOR_EMAIL` and preserves the intended recipient separately.
8. Raw notices and uploads are private and retention-limited. Public demos contain sanitized fixtures only.
9. Untrusted email, OCR, page, URL, metadata, and model text is data, never runtime instruction.
10. Every public case operation is scoped by a strong capability token whose hash—not plaintext—is stored.

## Authority tiers

- **Tier 1:** exact CPSC recall record or allowlisted U.S. government recall source.
- **Tier 2:** manufacturer/recall-support page directly linked from Tier 1.
- **Tier 3:** retailer page independently linked or corroborated by Tier 1/2.
- **Tier 4:** inbound notice, search results, media, social posts, or uncorroborated pages.

## State machine

`RECEIVED` → `EXTRACTING_CLAIMS` → `CLAIMS_READY` → `ACQUIRING_EVIDENCE` → `EVALUATING`, then exactly one evaluation state:

- `ACTIONABLE`
- `NEEDS_IDENTIFIER`
- `BLOCKED_CONFLICT`
- `NO_AUTHORITATIVE_EVIDENCE`
- `VERIFICATION_FAILED_RETRYABLE`

Action path: `ACTIONABLE` → `AWAITING_APPROVAL` → `CONTACTING_VERIFIED_CHANNEL` → `AWAITING_REPLY` → `REMEDY_CONFIRMED` → `RESOLVED`.

Terminal/manual closure may transition from bounded states to `CLOSED_UNRESOLVED`. Invalid transitions fail transactionally with a typed error. External work is scheduled only after its authorizing transition commits.

## Verdict codes

- `VERIFIED_OFFICIAL_CHANNEL`
- `VERIFIED_RECALL_UNSAFE_CHANNEL`
- `POSSIBLE_MATCH_NEEDS_IDENTIFIER`
- `CONFLICTING_NOTICE`
- `NO_AUTHORITATIVE_EVIDENCE`
- `VERIFICATION_FAILED_RETRYABLE`

Every append-only verdict version records ordered rule results, evidence IDs, missing identifiers, blocked/eligible actions, input hashes, engine version, explanation, and last-checked time.

## ClaimEnvelope v1

A strict schema captures language/type, claimed and parsed sender identity, retailer/manufacturer/product/category, recall ID, model/serial/lot/UPC/order/purchase and affected dates, hazard/urgency/remedy, all URLs/emails/phones/physical destinations, sensitive-data requests, and a source span plus extraction confidence for every material field. Confidence routes clarification only; it never scores truth. Invalid output receives one bounded retry, then a safe retryable failure.

## Limits

- Text: 50,000 characters; image: 8 MiB; accepted images: PNG/JPEG/WebP.
- Firecrawl: maximum 12 pages, same registrable domain, depth 2, no external links.
- Model attempts: 2; external retries: 3 only for transient errors with bounded backoff.
- Public expensive actions: capability- and time-window limited.
- Raw-content retention: 7 days by default, configurable from 1 to 30 days; sanitized receipts and derived evidence can remain.

## Acceptance criteria

- Three deterministic demo fixtures yield their declared verdicts.
- One real vertical slice reaches Convex through real AgentMail inbound, valid OpenAI extraction, real Firecrawl evidence/progress, explicit approval, and controlled AgentMail send.
- Reactive UI has no client polling and covers loading, offline, expired, rate-limited, retry, empty, and failure states.
- Unit, integration, browser, accessibility, format, lint, typecheck, build, and Convex push checks pass through `npm run verify` plus deployment-specific commands.
- Public `convex.site`, root `hackathon.md`, public repository, submission docs, and sub-three-minute demo are ready.

## Non-goals

No global recall feed, generic phishing score, whole-inbox access, chatbot, autonomous form/login/payment/refund/destruction, non-CPSC jurisdiction, blockchain, legal advice, official affiliation, or claimed completed remedy based only on sent email.
