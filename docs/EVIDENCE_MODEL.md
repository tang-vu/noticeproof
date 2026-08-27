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

## Claim graph

A validated `ClaimEnvelope` is normalized into individual `claims`. An `evidenceEdge` links one claim to one source as `supports`, `contradicts`, `narrows`, or `unresolved`, with a deterministic match method, rule ID, locator, and short excerpt. Excerpts are evidence locators, not wholesale page copies.

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

## Receipt

The receipt hashes notice, claim envelope, verdict, evidence manifest, optional approval, and visible timeline. Canonical JSON recursively sorts object keys while preserving ordered arrays. The JSON export states whether it came from a sanitized fixture or live data and never includes raw notice content, capability tokens, secrets, or unnecessary PII.
