# Three-minute demo script

Target: 2:45–2:55. Talk less; keep the product visible.

Published demo: https://youtu.be/KX4xkUp6Qm8 (2:44)

## 0:00–0:18 — The problem

Open the landing page.

“Urgent recall messages can be fake—or describe a real recall while sending you through the wrong door. NoticeProof verifies the notice before you click.”

Point to the forwarding address and three seeded outcomes.

## 0:18–1:08 — Hero case

Open **Real recall · unsafe channel**.

“This forwarded message accurately names a Paris Hilton mini-fridge recall. NoticeProof extracts the claims, then treats the message itself as untrusted.”

Scroll through the ledger: product, recall ID, hazard, remedy, then stop on the contradicted destination. Open the Tier 1 CPSC evidence.

“The product and model match CPSC recall 25-459. The notice link does not appear in authoritative evidence, so the deterministic verdict is: real recall, unsafe channel.”

## 1:08–1:48 — Safe channel switch

Point to `recall@epoca.com` and its Tier 1 source. Click **Review exact message**.

“NoticeProof starts a new thread; it never blindly replies to the suspicious sender. The exact recipient and redacted payload are bound to this verdict and evidence version.”

In live demo mode, show the clearly labeled controlled destination, approve, and show AgentMail delivery. In fixture-only mode, explicitly say no email is sent.

## 1:48–2:18 — Realtime closure

In the configured live environment, trigger the controlled reply.

“AgentMail preserves the thread. Convex ingests the signed event and the case timeline changes immediately—no refresh and no frontend polling.”

If live credentials are unavailable, do not simulate this claim; show the fixture timeline and state the missing gate.

For rehearsal, `npm run proof:live -- https://<deployment>.convex.site` asserts the OpenAI → Firecrawl → deterministic verdict → verified-contact path. Allow up to two minutes for sponsor APIs and keep the seeded hero case ready so upstream latency never creates an unexplained pause in the recorded demo.

## 2:18–2:43 — Receipt and nuance

Download the JSON receipt. Briefly show hashes, rule IDs, evidence manifest, approval binding, and timestamps. Open the verified-official fixture and show the generic Gmail trust note.

“A generic address can still be verified when CPSC explicitly lists the exact mailbox. Appearance is not authority; provenance is.”

## 2:43–2:55 — Close

“NoticeProof does not ask AI what is true. It uses AI to structure claims, authoritative web evidence to verify them, and a human-approved verified channel to act safely.”
