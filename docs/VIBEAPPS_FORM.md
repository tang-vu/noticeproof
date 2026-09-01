# VibeApps submission form — NoticeProof

Copy the values below into the matching fields. Do not click **Submit App** until the public social-post URL is filled and the final repository changes are pushed.

## Project details

### App Title

```text
NoticeProof
```

### App/Project Tagline

128/140 characters.

```text
Forward a recall notice. NoticeProof verifies every claim and switches you to an independently trusted contact—before you click.
```

### Description

```markdown
## The problem

Urgent product-recall messages are not simply real or fake. A notice can accurately describe a genuine recall while substituting an unsafe login, email address, or refund destination. Consumers need to know whether this particular notice applies to their product—and which independently verified channel they should use next.

## How NoticeProof works

NoticeProof treats every inbound notice as untrusted claims:

1. Forward an email, paste its text, or upload a screenshot.
2. OpenAI converts it into a schema-validated, source-spanned ClaimEnvelope.
3. Firecrawl discovers and captures current CPSC and authority-linked manufacturer evidence.
4. Deterministic TypeScript rules compare recall IDs, exact product identifiers, remedies, links, and contacts.
5. Convex streams evidence, rule results, verdict versions, and timeline changes to the UI in realtime.
6. When an authoritative source verifies an email contact, the consumer reviews the exact recipient and redacted payload before AgentMail starts a new trusted thread.

The key outcome is more nuanced than phishing detection:

**Real recall. Unsafe channel.**

## Notable features

- Three distinct seeded outcomes with real CPSC evidence
- Claim-by-claim evidence ledger with source spans and rule IDs
- Explicit authority tiers: search rank never establishes trust
- Exact model, lot, serial, UPC, recall-ID, remedy, and contact matching
- Independently verified safe-channel switching
- Version-bound, expiring, single-use human approval before email
- Signed and deduplicated AgentMail webhook processing
- Reactive crawl, extraction, delivery, reply, and timeline state
- Append-only verdict versions and downloadable evidence receipts
- Capability-scoped private cases, retention cleanup, redaction, and rate limits
- Accessible responsive UI with deliberate loading, retry, offline, and failure states

## Why I built it

Recall notices arrive during an anxious moment. Existing tools mostly answer whether a product has ever been recalled. NoticeProof answers the immediate safety question: “Is this particular notice trustworthy, does it apply to my exact product, and what independently verified channel should I use?”

## Sponsor stack

- **Convex:** typed operational state, transactions, indexed queries, files, schedulers, HTTP webhooks, idempotency, components, realtime subscriptions, approvals, timelines, and evidence receipts.
- **OpenAI:** strict semantic extraction and bounded rule-grounded explanations. It cannot select authority, verdicts, recipients, or eligible actions.
- **Firecrawl:** search, scrape, and bounded durable crawling of current official evidence with provenance and SHA-256 content hashes.
- **AgentMail:** persistent deliberate-forwarding inbox, signed inbound events, durable approved sending, thread history, status, and replies.

## Challenges

The hardest challenge was preventing plausible model output or high-ranking search results from becoming “truth.” NoticeProof separates semantic extraction from deterministic authority policy, validates every external boundary, preserves evidence versions, and invalidates approvals when evidence changes.

The second challenge was safely connecting suspicious inbound email to a new trusted thread without replying to the original sender or silently contacting a real manufacturer during demonstrations.

## Validation

- 86 unit and integration tests passing
- 12 Playwright browser flows passing across desktop and mobile
- Automated WCAG checks on the landing and hero evidence case
- Three deterministic, idempotent public demo fixtures
- Production Convex, OpenAI, Firecrawl, and AgentMail paths exercised with sanitized data

## Limitations

The MVP focuses on U.S. CPSC consumer-product recalls. A lack of authoritative evidence is never labeled “safe.” Phone, retailer, physical-return, and web-form remedies remain explicit human actions. NoticeProof is not affiliated with CPSC or any manufacturer and does not provide legal advice.
```

## Links and media

### App Website Link

```text
https://lovely-eel-809.convex.site
```

### GitHub Repo URL

```text
https://github.com/tang-vu/noticeproof
```

### LinkedIn Share or profile link

Publish this as a public LinkedIn post:

```text
Urgent recall messages can be fake—or describe a real recall while sending you through the wrong door.

I built NoticeProof for the Convex All Gas Hackathon.

NoticeProof treats every inbound recall notice as untrusted claims. It independently acquires authoritative CPSC evidence, checks exact product and recall details with deterministic rules, blocks unsafe links or contacts, and—only after explicit human approval—starts a new AgentMail thread with an independently verified recipient.

The key verdict is more nuanced than a phishing score:

Real recall. Unsafe channel.

Convex runs the typed realtime state machine, evidence record, approvals, webhooks, schedulers, and reactive UI. OpenAI performs schema-constrained claim extraction and bounded explanations, but it cannot decide what is true. Firecrawl acquires changing official evidence with provenance and content hashes. AgentMail receives deliberate forwards and powers the verified-channel email thread.

The production app includes three public cases, claim-level evidence, ordered rule results, exact source spans, a safe-action preview, and downloadable evidence receipts.

Live app: https://lovely-eel-809.convex.site
Video demo: https://youtu.be/KX4xkUp6Qm8
Source code: https://github.com/tang-vu/noticeproof

Don't click the recall. Prove it.

#AllGasHackathon #Convex #OpenAI #Firecrawl #AgentMail #Codex
```

Public LinkedIn post URL:

```text
https://lnkd.in/p/gm86t8XD
```

### X (Twitter) share or profile link

Publish this as one public X post. The text is 248 raw characters, including the full URLs.

```text
Don't click the recall. Prove it.

NoticeProof verifies claims against CPSC evidence and switches you to a trusted contact—without asking AI what is true.

Live: https://lovely-eel-809.convex.site
Demo: https://youtu.be/KX4xkUp6Qm8
#AllGasHackathon
```

Public X post URL:

```text
https://x.com/tangvu_dev/status/2094678746427199663
```

### Video Demo

```text
https://youtu.be/KX4xkUp6Qm8
```

### Screenshot or Image

Upload this as the required main image:

```text
demo-output/NoticeProof-thumbnail.png
```

### Additional Images

Upload these two images:

```text
docs/assets/noticeproof-case.png
docs/assets/noticeproof-home.png
```

The case image demonstrates the differentiated verdict, claim ledger, authority evidence, verified recipient, timeline, and deterministic rules. The home image shows the complete public intake and sponsor-proof experience. Do not upload the contact sheet.

## Additional questions

### Hosting URL type

Select:

```text
convex.site
```

## About you

### Your Name

Enter your real name.

```text
[YOUR_REAL_NAME]
```

### Email

Enter the email address where hackathon organizers can contact you. It is hidden from the public submission.

```text
[YOUR_EMAIL]
```

## Hackathon team info

### Team Name

```text
NoticeProof
```

### Selected Tags

Select all six visible tags:

```text
convex
AllGasHackathon
OpenAI
Firecrawl
codex
AgentMail
```

Do not add unrelated tags.

## Final pre-submit check

- Public app opens without authentication: `https://lovely-eel-809.convex.site`
- Public GitHub repository opens: `https://github.com/tang-vu/noticeproof`
- Public demo video opens and is under three minutes: `https://youtu.be/KX4xkUp6Qm8`
- Main screenshot and two additional images are uploaded
- Exactly six sponsor/event tags are selected
- Public LinkedIn and X post URLs are present
- Final video/submission repository batch is committed and pushed
- Name and notification email are correct
- No API key, private email body, capability token, or controlled demo destination appears in the form
- Save a screenshot of the confirmation after submission
