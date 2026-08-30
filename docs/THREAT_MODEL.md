# Threat model

## Assets and trust boundaries

Protected assets are raw notices/attachments, capability tokens, sponsor keys/webhook secrets, extracted PII, evidence snapshots, approval payloads, and email threads. Untrusted inputs include email headers/body/HTML, attachments/OCR, URLs/redirects, crawled pages, search results, external API payloads, and model output.

## Threats and implemented controls

| Threat                              | Control                                                                                                                                                                                    | Evidence/status                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Prompt injection                    | System boundary labels notice/page/image text as data; extraction contract forbids verdict/authority/action decisions; Zod strict output                                                   | Implemented in `shared/server/openaiExtraction.ts` and tests          |
| Malformed/hallucinated model output | Responses `parse` + strict Zod schema, exact-quote span validation, unique-quote offset repair, at most two attempts, no partial persistence; explanations are filtered by stored rule IDs | Implemented, adversarially tested, and exercised live                 |
| XSS/email HTML                      | UI renders React text only; sanitizer removes scripts/styles/tags/control bytes; no `dangerouslySetInnerHTML`                                                                              | Implemented and tested                                                |
| SSRF/unsafe schemes                 | Only HTTP(S), no URL credentials, local/private IPv4/IPv6 rejected, public registrable domain required                                                                                     | Implemented and tested                                                |
| Homograph/subdomain tricks          | URL normalization, punycode flag, canonical hostname plus registrable-domain comparison; live evidence UI displays the canonical domain                                                    | Implemented and tested                                                |
| Email header/recipient injection    | Recipient must come from Tier 1/linked Tier 2 evidence; CR/LF is rejected and one mailbox is normalized before payload hashing                                                             | Implemented in `convex/approvals.ts` and tested                       |
| Webhook spoof/replay/order          | Official AgentMail component verifies the webhook; app callback deduplicates event/message IDs and stores sanitized text only                                                              | Implemented; duplicate callback test passes                           |
| Broken case access                  | 256-bit random capability; only SHA-256 hash stored; every private query/mutation scopes through the case; indexed hourly expiry revokes access                                            | Implemented; wrong-token, fixture, and expired-link tests pass        |
| Forward-code theft/replay           | Separate 96-bit random subject code is hash-indexed, single-use, expires in 24 hours, and grants no read capability                                                                        | Attach, cross-case, and replay tests pass                             |
| Cross-case subscription leak        | Public fixtures are explicitly allowlisted; private reads require capability; public responses omit raw IDs, component IDs, model IDs, and idempotency keys                                | Implemented and tested                                                |
| Secret leakage                      | Secrets only in Convex env; `.env*` ignored except names-only example; no raw payload logging                                                                                              | Repository/diff scans pass; OpenAI and AgentMail live paths inspected |
| PII retention                       | Seven-day retention, bounded cleanup, capability-holder purge; inbound summaries are redacted and full outbound payloads are deleted after terminal approval state                         | Implemented and tested                                                |
| Approval/send race                  | Approval binds verdict version, evidence hash, payload hash, expiry; send consumes once; evidence changes expire approval and purge its payload                                            | Transactional wrapper implemented and tested                          |
| Crawl amplification/file abuse      | 40k text, 8 MiB allowlisted image types, search limit 5, scrape limit 3, crawl limit 12/depth 2/same domain, bounded retries, public rate windows                                          | Enforced in actions/mutations and tested at boundaries                |
| Demo leakage                        | Intended/actual recipient are separate and visibly labeled; demo mode requires `DEMO_VENDOR_EMAIL`; missing configuration blocks                                                           | Implemented in UI/schema/send transaction                             |
| Network/query failure               | Whole-app error boundary and offline announcement preserve a non-verdict recovery state instead of a blank page                                                                            | Implemented and tested                                                |

## Security decisions

- Deliberate forwarding replaces whole-inbox access.
- Raw HTML is never rendered, even after sanitization.
- Search finds candidates but never grants authority.
- A model can extract, align, ask, and explain; it cannot set verdict, tier, recipient, eligibility, or approval.
- Explanation output is constrained to verdict-specific template IDs and existing rule IDs; TypeScript renders the text and rejects invented references.
- No autonomous login, payment, refund acceptance, form submission, disposal, or product destruction.
- Public fixtures contain no actual consumer or private message data.
- Identical notice text may create separate capability-scoped cases; deduplication is scoped to webhook/message idempotency so one consumer cannot infer another consumer’s submission.
- Remedy confirmation and resolution are explicit consumer declarations. Delivery or reply events alone never advance those states or claim fulfillment.

## Residual risk

- Production has exercised a sanitized signed AgentMail notice through case creation, strict OpenAI extraction, authoritative evidence, and deterministic verdict. Its enabled inbox-scoped webhook uses a separate secret, and an unsigned request returns 401. Controlled delivery, signed delivery status, and reply attachment are additionally exercised on the development deployment.
- Public rate limiting is intentionally coarse because the no-login demo has no trusted per-user identity or edge IP. It limits amplification but a distributed attacker could still consume shared quota.
- Production Insights observed one non-failing optimistic-concurrency retry inside the official AgentMail callback-pool component. No application error or exhausted retry was observed.
- Screenshot-only fields use exact quoted text with a zero offset because ClaimEnvelope v1 has text offsets, not image coordinates. The quote remains reviewable, but pixel-level provenance is a future schema revision.
- Uploads abandoned before case creation are not attached to the application retention index; public upload URL issuance is therefore tightly rate-limited.
