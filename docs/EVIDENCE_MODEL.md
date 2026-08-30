# Evidence model

## Authority is a relationship

A URL does not become authoritative because it looks official or ranks highly. NoticeProof assigns authority through provenance:

| Tier | Meaning                                                         | Permitted use                                           |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Exact allowlisted government recall record, currently CPSC      | Establish recall, scope, remedy, and listed contact     |
| 2    | Manufacturer/recall-support page directly linked by Tier 1      | Expand changing remedy detail and verify exact contact  |
| 3    | Retailer page linked or independently corroborated by Tier 1/2  | Supporting context only                                 |
| 4    | Notice, search result, media/social page, or uncorroborated URL | Claim source or discovery lead; never establishes truth |

Each source stores canonical URL/domain, source type, discovery parent, authority tier, fetch/update time, status, title, SHA-256 content hash, optional private snapshot, truncation, extraction state, and whether it independently verifies a contact.

The structured CPSC API is used only to narrow exact recall-number discovery and is validated as an external payload. A network failure or malformed response does not produce a substantive verdict. Tier 2 crawl targets are selected from the links actually returned with Tier 1 evidence, never from search position or the inbound notice.

## Claim graph

A validated `ClaimEnvelope` is normalized into individual `claims`. The ledger preserves every source-spanned material field: claimed sender, retailer, manufacturer, product/category, identifiers, order and date fields, hazard/urgency/remedy, channels/destinations, and sensitive requests. An `evidenceEdge` links one claim to one source as `supports`, `contradicts`, `narrows`, or `unresolved`, with a deterministic match method, rule ID, locator, and short excerpt. Excerpts are evidence locators, not wholesale page copies.

Exact recall numbers and model/lot/serial/UPC/date scopes outrank semantic similarity. Generic email providers are acceptable only when the exact address appears in Tier 1 or Tier 2 reached from Tier 1.

## Verdict integrity

Verdicts are append-only. A version binds:

- the validated claim-envelope hash;
- the canonical ordered evidence-manifest hash;
- rule-engine version and ordered rule results;
- supporting/contradicting evidence IDs;
- missing identifiers, blocked actions, and eligible actions;
- a bounded explanation containing no fact outside the structured result;
- last-checked timestamp.

Codes distinguish official channel, real recall/unsafe channel, missing identifier, conflict, no authoritative evidence, and retryable infrastructure failure. “Safe” is intentionally not a verdict.

`NP-REMEDY-001` blocks only an explicit normalized remedy contradiction: the notice has a known remedy type, the authoritative record exposes at least one recognized remedy type, and the claimed type is absent from that authoritative set. Missing or ambiguous remedy language never becomes a contradiction. Bounded OpenAI explanations are rule-aware, so a remedy-only conflict cannot select the sensitive-request template.

## Receipt

The receipt hashes notice, claim envelope, verdict, evidence manifest, optional approval, and visible timeline. Canonical JSON recursively sorts object keys while preserving ordered arrays. The JSON export states whether it came from a sanitized fixture or live data and never includes raw notice content, capability tokens, secrets, or unnecessary PII.

Live receipts are persisted transactionally at `verdict_created`, `approval_consumed`, `remedy_confirmed`, and `case_resolved`. Each later receipt is a new row rather than a mutation of history. The capability-scoped UI displays hash prefixes and downloads the complete machine-readable JSON; intended/actual payload bodies and private component IDs are excluded.

Active non-fixture cases are rechecked after 24 hours by a bounded six-hour scheduler. Any pending approval is expired before the case commits back to `ACQUIRING_EVIDENCE`; only then is the external acquisition action scheduled. Cases awaiting a trusted-thread reply receive a bounded human follow-up reminder after seven days.
