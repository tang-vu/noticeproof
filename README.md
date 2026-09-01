# NoticeProof

> **Don't click the recall. Prove it.**

NoticeProof verifies the claims in a suspicious recall notice against authoritative evidence, moves the consumer to an independently verified contact channel, and records the remedy journey without asking an LLM to decide what is true.

![NoticeProof landing and recall evidence workflow](docs/assets/noticeproof-home.png)

## The thirty-second explanation

Urgent recall messages can be fake, outdated, incomplete—or describe a real recall while substituting an unsafe link. NoticeProof decomposes the exact message into claims, finds the matching CPSC record and authority-linked manufacturer evidence, evaluates exact identifiers and contact details with deterministic rules, then requires approval before starting a new email thread through AgentMail.

**Live production demo:** https://lovely-eel-809.convex.site — public, capability-scoped, and hosted through Convex static hosting. Production AgentMail intake, Convex realtime, OpenAI structured extraction and bounded explanation, Firecrawl evidence acquisition, and deterministic verification have been exercised live; controlled AgentMail delivery and reply attachment are also proven on the development deployment.

## Three-step demo

1. Open **Real recall · unsafe channel**. The product and CPSC recall match, but the notice destination does not.
2. Inspect the claim ledger, authority tiers, source domains, ordered rule IDs, and why the unsafe notice link is blocked.
3. Review the independently recovered recipient and exact redacted payload, then download the evidence receipt. The fixture preview cannot silently send mail.

For the live forwarding path, choose **Start a tracked forward** first. NoticeProof creates a one-time expiring subject code and opens the private reactive case before the email leaves your inbox, so the result returns to the same browser without exposing the capability in the email.

The verified-official demo also shows why a generic Gmail address can be trusted when the exact address is explicitly listed in Tier 1 CPSC evidence.

## Why this is different

NoticeProof is not a recall feed: its object is a particular notice in an anxious moment. It is not a generic phishing score: a message may describe a genuine recall but still use an unverified action channel. It does not ask AI for a confidence-based truth verdict. Authority and exact identifiers are evaluated in versioned TypeScript rules with cited evidence IDs.

## Sponsor architecture

- **Convex** is the operational core: typed indexed data, capability-scoped cases, transactional state transitions, component state, storage, HTTP webhooks, schedulers, idempotency, append-only verdicts/timelines/receipts, and reactive UI subscriptions.
- **OpenAI Responses API** performs strict `ClaimEnvelope` extraction and a separately stored bounded explanation. Every source-spanned material field reaches the claim ledger. For explanations, the model may select only templates established by the exact stored rule IDs; TypeScript renders the final text. `OPENAI_MODEL` defaults to `gpt-5-mini` and stays server-side.
- **Firecrawl’s Convex component** performs search/scrape and a bounded durable manufacturer-domain crawl selected only from links on Tier 1 evidence; stored pages and progress are reactive Convex state. Search position never grants authority.
- **AgentMail’s Convex component** owns the persistent inbox, verified/deduplicated inbound events, threads, durable delivery, and replies. A send requires a current single-use approval and independently verified recipient.

The components are registered in `convex/convex.config.ts`. Production visibly exposes privacy-safe proof of signed AgentMail intake, OpenAI extraction and bounded explanation, Firecrawl-backed authority evidence, and Convex realtime state. The development deployment additionally proves controlled delivery and reply attachment: an approved message reached the explicitly labeled demo destination, and signed replies attached to the original trusted thread.

## Safety and limits

- Absence of authoritative evidence is never labeled safe.
- Missing model/lot/serial/UPC/date information produces a clarification state.
- Only Tier 1 or Tier 1-linked Tier 2 evidence can verify a contact.
- Raw email HTML is never rendered; URL schemes, credentials, local/private hosts, trackers, punycode, and registrable domains are handled explicitly.
- Forwarding subject codes are random, single-use, expire after 24 hours, and cannot open a case; the separate 256-bit capability stays in browser session storage.
- Private capability access is revoked after case expiry; raw content has separate bounded retention cleanup. Active live cases receive scheduled evidence rechecks that invalidate stale approval.
- A private capability holder can immediately purge uploaded/raw notice content, source quotes, private contact values, and pending outbound payloads. The case closes unresolved while derived hashes and public authority evidence remain auditable.
- Demo mode must show intended and actual recipients separately. The fixture approval dialog never sends.
- A sent message or reply never marks a remedy complete; only the consumer can confirm instructions and resolve their case, with each step appended to a new receipt.
- NoticeProof is not affiliated with CPSC or a manufacturer, does not provide legal advice, and cannot guarantee coverage or a completed remedy.

See [Threat model](docs/THREAT_MODEL.md) and [Evidence model](docs/EVIDENCE_MODEL.md).

## Local setup

Requirements: Node.js 22+ (tested with 24.14.1), npm 11+, and a Convex account or local Convex backend.

Set `VITE_AGENTMAIL_FORWARDING_ADDRESS` only after AgentMail has created the real public inbox; the UI labels the inbox unavailable rather than displaying a fixture address.

```bash
npm ci
npm run dev
```

The seeded fixture UI works without secrets. For the live path, copy variable names from `.env.example` and set all secrets in the Convex deployment—not a Vite/browser file:

```bash
npx convex env set OPENAI_API_KEY
npx convex env set OPENAI_MODEL gpt-5-mini
npx convex env set FIRECRAWL_API_KEY
npx convex env set FIRECRAWL_WEBHOOK_SECRET
npx convex env set AGENTMAIL_API_KEY
npx convex env set AGENTMAIL_WEBHOOK_SECRET
npx convex env set AGENTMAIL_INBOX_ID
npx convex env set DEMO_MODE true
npx convex env set DEMO_VENDOR_EMAIL
npx convex env set CAPABILITY_HASH_PEPPER
```

Then run Convex and Vite in separate terminals:

```bash
npm run dev:convex
npm run dev
```

## Validation and deployment

```bash
npm run verify       # format, lint, types, unit tests, build, Playwright
npm run seed         # idempotent sanitized demo data (after Convex codegen/push)
npm run proof:live -- https://<deployment>.convex.site # paid live sponsor proof
npm run deploy       # Convex backend + atomic Vite static upload
```

`proof:live` submits only a sanitized fixture, waits for the realtime deterministic verdict, and asserts that the safe action uses the independently recovered CPSC contact. Add `--send` after the URL to explicitly approve a controlled AgentMail delivery. It intentionally invokes paid sponsor APIs; demo routing stays visible and never silently contacts the manufacturer. The validation gate also runs axe WCAG checks against the landing and hero evidence case.

Deployment requires an authenticated Convex project and configured sponsor credentials. `@convex-dev/static-hosting` publishes the Vite build at `https://<deployment>.convex.site`.

## Project record

- [Hackathon build log](hackathon.md)
- [Frozen product contract](SPEC.md)
- [Execution plan](PLANS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Evidence model](docs/EVIDENCE_MODEL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Submission checklist](docs/SUBMISSION_CHECKLIST.md)
- [Paste-ready submission copy](docs/SUBMISSION_COPY.md)
- [VibeApps form copy](docs/VIBEAPPS_FORM.md)
- [Social launch copy](docs/SOCIAL_POST.md)
- [Video voiceover and upload copy](docs/video/)

**Demo video:** [Watch the 2:44 product walkthrough on YouTube](https://youtu.be/KX4xkUp6Qm8).

## License

[MIT](LICENSE)
