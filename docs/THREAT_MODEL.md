# Threat model

## Assets and trust boundaries

Protected assets are raw notices/attachments, capability tokens, sponsor keys/webhook secrets, extracted PII, evidence snapshots, approval payloads, and email threads. Untrusted inputs include email headers/body/HTML, attachments/OCR, URLs/redirects, crawled pages, search results, external API payloads, and model output.

## Threats and implemented controls

| Threat                              | Control                                                                                                                            | Evidence/status                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Prompt injection                    | System boundary labels notice/page text as data; extraction contract forbids verdict/authority/action decisions; Zod strict output | Implemented in `shared/server/openaiExtraction.ts` and tests        |
| Malformed/hallucinated model output | Responses `parse` + strict Zod schema, at most two attempts, no partial persistence                                                | Implemented and tested                                              |
| XSS/email HTML                      | UI renders React text only; sanitizer removes scripts/styles/tags/control bytes; no `dangerouslySetInnerHTML`                      | Implemented and tested                                              |
| SSRF/unsafe schemes                 | Only HTTP(S), no URL credentials, local/private IPv4/IPv6 rejected, public registrable domain required                             | Implemented and tested                                              |
| Homograph/subdomain tricks          | Browser URL normalization, punycode flag, canonical hostname plus registrable-domain display/comparison                            | Implemented and tested; visual warning wiring pending               |
| Email header/recipient injection    | Recipient must come from verified structured source; final wrapper must reject CR/LF and normalize one mailbox                     | Domain helper ready; live wrapper pending                           |
| Webhook spoof/replay/order          | Official component signature verification; component event dedupe plus app idempotency mapping; monotonic status reducer           | Components registered; app callback tests pending                   |
| Broken case access                  | Strong random capability; store hash only; every private function must scope through the case                                      | Schema/ADR complete; live wrappers pending                          |
| Cross-case subscription leak        | Public query returns only sanitized fixture projection or capability-scoped projection                                             | Pending generated Convex bindings/tests                             |
| Secret leakage                      | Secrets only in Convex env; `.env*` ignored except names-only example; no raw payload logging                                      | Implemented repository controls; runtime log audit pending          |
| PII retention                       | Private storage IDs, default 30-day raw retention, scheduled cleanup, sanitized public fixtures                                    | Schema/config documented; scheduler pending                         |
| Approval/send race                  | Approval binds verdict version, evidence hash, payload hash, expiry; single consumption; evidence changes fail                     | Pure protocol implemented and tested; transactional wrapper pending |
| Crawl amplification/file abuse      | 50k text, 8 MiB image, 12 pages/depth 2/same domain, bounded retries and rate windows                                              | Contract/schema present; action enforcement pending                 |
| Demo leakage                        | Intended/actual recipient are separate; fixture dialog says no send; live demo must require `DEMO_VENDOR_EMAIL`                    | UI/schema implemented; live action pending                          |

## Security decisions

- Deliberate forwarding replaces whole-inbox access.
- Raw HTML is never rendered, even after sanitization.
- Search finds candidates but never grants authority.
- A model can extract, align, ask, and explain; it cannot set verdict, tier, recipient, eligibility, or approval.
- No autonomous login, payment, refund acceptance, form submission, disposal, or product destruction.
- Public fixtures contain no actual consumer or private message data.

## Residual risk

The current local fixture UI is not a live security boundary. Capability enforcement, webhook callback mapping, cleanup/rate-limit jobs, and AgentMail send transactions require generated Convex bindings and runtime tests. They must not be represented as complete until those gates pass.
