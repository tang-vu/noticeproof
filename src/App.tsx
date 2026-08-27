import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { demoCases, getDemoCase, type DemoCase } from "./demoData";

const VERDICT_COPY = {
  VERIFIED_OFFICIAL_CHANNEL: {
    eyebrow: "Verified official channel",
    title: "The recall and this contact channel match.",
    next: "Review the verified recipient before starting a new email thread.",
    tone: "verified",
  },
  VERIFIED_RECALL_UNSAFE_CHANNEL: {
    eyebrow: "Real recall · unsafe channel",
    title: "The recall is real. This notice’s link is not verified.",
    next: "Do not use the notice link. Switch to the contact listed by CPSC.",
    tone: "blocked",
  },
  CONFLICTING_NOTICE: {
    eyebrow: "Blocked conflict",
    title: "This notice asks for sensitive information without authoritative support.",
    next: "Do not sign in, share a code, or use the supplied destination.",
    tone: "blocked",
  },
  NO_AUTHORITATIVE_EVIDENCE: {
    eyebrow: "No authoritative evidence",
    title: "No matching CPSC evidence was found.",
    next: "This does not prove the product is safe. Recheck later or contact CPSC directly.",
    tone: "uncertain",
  },
} as const;

function verdictCopy(code: string) {
  return VERDICT_COPY[code as keyof typeof VERDICT_COPY] ?? VERDICT_COPY.NO_AUTHORITATIVE_EVIDENCE;
}

const stateSteps = [
  "Claims extracted",
  "Evidence acquired",
  "Rules evaluated",
  "Safe action ready",
];

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const match = /^#\/case\/([^/?]+)/.exec(hash);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Header({ compact = false }: { compact?: boolean }) {
  return (
    <header className={compact ? "site-header compact" : "site-header"}>
      <a className="brand" href="#/" aria-label="NoticeProof home">
        <Mark /> NoticeProof
      </a>
      <nav aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#privacy">Privacy</a>
        <a className="nav-action" href="#intake">
          Verify a notice
        </a>
      </nav>
    </header>
  );
}

function Landing() {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const inbox = "forward@noticeproof.agentmail.to";

  const copyInbox = async () => {
    await navigator.clipboard.writeText(inbox);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() && !fileName) {
      setStatus("Paste the notice or choose an image first.");
      return;
    }
    setStatus(
      import.meta.env.VITE_CONVEX_URL
        ? "Secure intake is connecting to Convex."
        : "Live intake is not configured in this local build. Open a seeded case to explore the complete verified workflow.",
    );
  };

  return (
    <div className="page landing">
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">
              <span className="live-dot" /> Independent recall verification
            </p>
            <h1>
              Don’t click the recall. <em>Prove it.</em>
            </h1>
            <p className="hero-lede">
              Forward a recall notice. NoticeProof checks each claim against authoritative evidence,
              blocks unverified channels, and helps you act through a trusted contact.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#intake">
                Verify a notice <span aria-hidden="true">→</span>
              </a>
              <a className="button secondary" href="#/case/real-recall-unsafe-channel">
                See the 60-second demo
              </a>
            </div>
            <p className="privacy-line">
              No inbox access. No tracking pixels. You deliberately forward only the notice you want
              checked.
            </p>
          </div>
          <aside className="proof-card" aria-label="Example claim verification">
            <div className="mail-heading">
              <div>
                <span className="mini-label">Forwarded notice</span>
                <strong>Safety recall — action required</strong>
              </div>
              <span className="fixture-pill">Demo fixture</span>
            </div>
            <div className="claim-row">
              <span className="claim-icon ok">✓</span>
              <div>
                <small>PRODUCT CLAIM</small>
                <strong>Paris Hilton Mini Beauty Fridge</strong>
                <p>Exact CPSC record match</p>
              </div>
            </div>
            <div className="claim-row">
              <span className="claim-icon ok">✓</span>
              <div>
                <small>RECALL CLAIM</small>
                <strong>Fire and burn hazard</strong>
                <p>Supported by CPSC 25-452</p>
              </div>
            </div>
            <div className="claim-row danger">
              <span className="claim-icon no">×</span>
              <div>
                <small>CONTACT CLAIM</small>
                <strong>epoca-refund.example</strong>
                <p>Not listed by CPSC or linked manufacturer evidence</p>
              </div>
            </div>
            <div className="mini-verdict">
              <span>!</span>
              <div>
                <small>NOTICEPROOF VERDICT</small>
                <strong>Real recall. Unsafe channel.</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="trust-strip" aria-label="Evidence workflow">
          <span>Powered by</span>
          <strong>Convex</strong>
          <i /> <strong>OpenAI</strong>
          <i /> <strong>Firecrawl</strong>
          <i /> <strong>AgentMail</strong>
        </section>

        <section className="intake-section" id="intake">
          <div className="section-heading">
            <p className="kicker">Start with the message—not its links</p>
            <h2>Send one notice. Keep your inbox private.</h2>
          </div>
          <div className="intake-grid">
            <form className="intake-card" onSubmit={submit}>
              <label htmlFor="notice-text">Paste the email or text message</label>
              <textarea
                id="notice-text"
                maxLength={50000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Paste the full notice here. Treat every link as untrusted until checked…"
              />
              <div className="intake-footer">
                <input
                  ref={fileRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setFileName(file.size > 8 * 1024 * 1024 ? "" : file.name);
                    setStatus(
                      file.size > 8 * 1024 * 1024
                        ? "Images must be 8 MiB or smaller."
                        : `Ready to verify ${file.name}.`,
                    );
                  }}
                />
                <button
                  className="upload-button"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  ＋ {fileName || "Add screenshot"}
                </button>
                <span>{message.length.toLocaleString()} / 50,000</span>
              </div>
              <button className="button primary wide" type="submit">
                Verify this notice <span>→</span>
              </button>
              <p className="form-status" role="status">
                {status}
              </p>
            </form>
            <div className="forward-card">
              <p className="step-number">Or forward it</p>
              <h3>Use your private NoticeProof inbox</h3>
              <p>
                Forward the message as-is. AgentMail preserves the thread while NoticeProof creates
                a separate, safer action channel.
              </p>
              <div className="copy-field">
                <code>{inbox}</code>
                <button type="button" onClick={() => void copyInbox()}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <ul>
                <li>Only messages you choose to forward</li>
                <li>Attachments stay private and expire</li>
                <li>Never replies to the original sender by default</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="demo-section" id="how-it-works">
          <div className="section-heading">
            <p className="kicker">Three outcomes worth distinguishing</p>
            <h2>Try a case. Inspect every decision.</h2>
            <p>
              Sanitized fixtures reproduce the deterministic evidence path. They are not presented
              as live messages.
            </p>
          </div>
          <div className="demo-grid">
            {demoCases.map((item) => (
              <DemoCard key={item.caseSlug} item={item} />
            ))}
          </div>
        </section>

        <section className="principles" id="privacy">
          <div>
            <span>01</span>
            <h3>AI structures. Rules decide.</h3>
            <p>
              Models extract and explain claims. Deterministic code assigns authority and verdicts.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Authority beats ranking.</h3>
            <p>
              A search result is a lead—not proof. Trust follows CPSC records and their direct
              links.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Approval before action.</h3>
            <p>
              You see the exact verified recipient and redacted payload before any message can
              leave.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function DemoCard({ item }: { item: DemoCase }) {
  const copy = verdictCopy(item.expectedVerdict);
  return (
    <article className="demo-card">
      <div className={`case-art ${copy.tone}`}>
        <Mark />
        <span>
          {item.expectedVerdict === "VERIFIED_RECALL_UNSAFE_CHANNEL"
            ? "REAL RECALL / WRONG DOOR"
            : item.expectedVerdict === "VERIFIED_OFFICIAL_CHANNEL"
              ? "OFFICIAL PATH CONFIRMED"
              : "UNVERIFIED / BLOCKED"}
        </span>
      </div>
      <div className="demo-card-body">
        <p className={`verdict-tag ${copy.tone}`}>{copy.eyebrow}</p>
        <h3>{item.notice.subject}</h3>
        <p>{copy.next}</p>
        <a href={`#/case/${item.caseSlug}`}>
          Open evidence case <span>→</span>
        </a>
      </div>
    </article>
  );
}

function CaseView({ item }: { item: DemoCase }) {
  const copy = verdictCopy(item.expectedVerdict);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const verifiedEmail = item.evidence.find((source) => "verifiedEmail" in source)?.verifiedEmail;
  const claims = useMemo(() => {
    const envelope = item.claimEnvelope as Record<string, unknown>;
    return Object.entries(envelope).filter(
      ([key, value]) =>
        value !== null &&
        (!Array.isArray(value) || value.length > 0) &&
        key !== "sensitiveRequests",
    );
  }, [item]);

  return (
    <div className="page case-page">
      <Header compact />
      <main className="case-shell">
        <div className="case-topline">
          <a href="#/">← All demo cases</a>
          <span className="fixture-pill">Sanitized fixture · v1</span>
        </div>
        <section className={`verdict-banner ${copy.tone}`}>
          <div className="verdict-symbol" aria-hidden="true">
            {copy.tone === "verified" ? "✓" : "!"}
          </div>
          <div>
            <p>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <span>{copy.next}</span>
          </div>
          <div className="checked">
            <small>LAST CHECKED</small>
            <strong>Aug 26, 2026</strong>
            <span>Fixture snapshot</span>
          </div>
        </section>

        <ol className="progress-line" aria-label="Verification progress">
          {stateSteps.map((step, index) => (
            <li key={step} className={index === 3 && !verifiedEmail ? "muted" : "done"}>
              <span>{index < 3 || verifiedEmail ? "✓" : index + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="case-layout">
          <div className="case-main">
            <section className="panel notice-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Forwarded notice</p>
                  <h2>{item.notice.subject}</h2>
                </div>
                <span className="tier tier4">Tier 4 · Untrusted</span>
              </div>
              <dl>
                <div>
                  <dt>From</dt>
                  <dd>{item.notice.sender}</dd>
                </div>
                <div>
                  <dt>Message</dt>
                  <dd>{item.notice.body}</dd>
                </div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Claim ledger</p>
                  <h2>What the notice says</h2>
                </div>
                <span>{claims.length} normalized fields</span>
              </div>
              <div className="ledger">
                {claims.map(([key, value]) => (
                  <div className="ledger-row" key={key}>
                    <div>
                      <small>{labelize(key)}</small>
                      <strong>{formatClaimValue(value)}</strong>
                    </div>
                    <span className={claimStatus(item, key)}>
                      {claimStatus(item, key) === "supported"
                        ? "Supported"
                        : claimStatus(item, key) === "conflict"
                          ? "Contradicted"
                          : "Unresolved"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Evidence trail</p>
                  <h2>Authority, not search rank</h2>
                </div>
                <span>
                  {item.evidence.length} source{item.evidence.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="evidence-list">
                {item.evidence.length ? (
                  item.evidence.map((source) => (
                    <article className="evidence-card" key={source.id}>
                      <div className="source-mark">{source.tier}</div>
                      <div>
                        <div className="evidence-meta">
                          <span className={`tier tier${source.tier}`}>Tier {source.tier}</span>
                          <span>{source.domain}</span>
                          <span>Fetched {source.retrievedDate}</span>
                        </div>
                        <h3>{source.title}</h3>
                        <p>
                          {source.relation === "contradicts"
                            ? "This destination appears only in the inbound notice and is not established by authoritative evidence."
                            : "This source supports the exact recall, product scope, or verified contact shown in the ledger."}
                        </p>
                        {"trustNote" in source && (
                          <div className="trust-note">
                            Why a generic address is trusted: {source.trustNote}
                          </div>
                        )}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          Open official source <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-evidence">
                    <strong>No authoritative source matched.</strong>
                    <p>
                      This is an unresolved absence—not proof that the notice is fake or the product
                      is safe.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="panel why-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Why this result?</p>
                  <h2>Ordered deterministic rules</h2>
                </div>
                <code>noticeproof-rules/1.0.0</code>
              </div>
              <ol>
                {ruleCopy(item).map((rule) => (
                  <li key={rule.id}>
                    <code>{rule.id}</code>
                    <div>
                      <strong>{rule.title}</strong>
                      <p>{rule.detail}</p>
                    </div>
                    <span className={rule.status}>{rule.status}</span>
                  </li>
                ))}
              </ol>
              <p className="ai-boundary">
                OpenAI can explain these structured results, but it cannot change the rule outcomes,
                authority tier, recipient, or verdict.
              </p>
            </section>
          </div>

          <aside className="case-side">
            <section className="panel next-panel">
              <p className="eyebrow">Safest next action</p>
              {verifiedEmail ? (
                <>
                  <h2>Start a new verified thread</h2>
                  <p>The recipient below was recovered independently from Tier 1 CPSC evidence.</p>
                  <div className="recipient">
                    <small>VERIFIED RECIPIENT</small>
                    <strong>{verifiedEmail}</strong>
                    <span>Established by CPSC</span>
                  </div>
                  <button className="button primary wide" onClick={() => setApprovalOpen(true)}>
                    Review exact message →
                  </button>
                </>
              ) : (
                <>
                  <h2>Do not use the notice channel</h2>
                  <p>
                    No verified email action is eligible. Use the official CPSC record directly or
                    recheck later.
                  </p>
                  <button className="button disabled wide" disabled>
                    No eligible email action
                  </button>
                </>
              )}
            </section>
            <section className="panel timeline-panel">
              <p className="eyebrow">Live timeline</p>
              <h2>Case activity</h2>
              <ol>
                <li>
                  <span />
                  <div>
                    <strong>Notice received</strong>
                    <p>Sanitized fixture loaded</p>
                    <time>14:32</time>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Claims validated</strong>
                    <p>ClaimEnvelope v1 accepted</p>
                    <time>14:32</time>
                  </div>
                </li>
                <li>
                  <span />
                  <div>
                    <strong>Evidence evaluated</strong>
                    <p>
                      {item.evidence.length} source{item.evidence.length === 1 ? "" : "s"} checked
                    </p>
                    <time>14:33</time>
                  </div>
                </li>
                <li className={approved ? "active" : "pending"}>
                  <span />
                  <div>
                    <strong>
                      {approved ? "Demo approval recorded" : "Waiting for your review"}
                    </strong>
                    <p>
                      {approved
                        ? "No email was sent from this fixture-only view"
                        : "External action remains blocked"}
                    </p>
                    <time>{approved ? "now" : "—"}</time>
                  </div>
                </li>
              </ol>
            </section>
            <section className="receipt-card">
              <div>
                <p className="eyebrow">Evidence receipt</p>
                <strong>Reproducible record</strong>
              </div>
              <button type="button" onClick={() => downloadReceipt(item)}>
                JSON ↓
              </button>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
      {approvalOpen && verifiedEmail && (
        <ApprovalDialog
          item={item}
          verifiedEmail={verifiedEmail}
          onClose={() => setApprovalOpen(false)}
          onApprove={() => {
            setApproved(true);
            setApprovalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ApprovalDialog({
  item,
  verifiedEmail,
  onClose,
  onApprove,
}: {
  item: DemoCase;
  verifiedEmail: string;
  onClose: () => void;
  onApprove: () => void;
}) {
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Explicit approval</p>
        <h2 id="approval-title">Review the exact destination and payload</h2>
        <div className="approval-facts">
          <div>
            <small>INTENDED VERIFIED RECIPIENT</small>
            <strong>{verifiedEmail}</strong>
          </div>
          <div>
            <small>DEMO DELIVERY</small>
            <strong>Not sent in fixture preview</strong>
          </div>
        </div>
        <div className="draft">
          <small>REDACTED OUTBOUND DRAFT</small>
          <p>
            <strong>Subject:</strong> Remedy request for {String(item.claimEnvelope.productName)}
          </p>
          <p>
            Hello, I am contacting you using the address independently listed by CPSC. I may own the
            recalled {String(item.claimEnvelope.productName)}. My order and contact details are
            [redacted until provided]. Please confirm the next human steps.
          </p>
        </div>
        <div className="dialog-warning">
          This preview records a local demo approval only. A live AgentMail send remains unavailable
          until the backend and controlled demo recipient are configured.
        </div>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={onApprove}>
            Approve demo preview
          </button>
        </div>
      </section>
    </div>
  );
}

function claimStatus(item: DemoCase, key: string) {
  if (item.expectedVerdict === "CONFLICTING_NOTICE")
    return key === "urls" ? "conflict" : "unresolved";
  if (item.expectedVerdict === "VERIFIED_RECALL_UNSAFE_CHANNEL" && key === "urls")
    return "conflict";
  return "supported";
}

function ruleCopy(item: DemoCase) {
  if (item.expectedVerdict === "CONFLICTING_NOTICE")
    return [
      {
        id: "NP-AUTH-001",
        title: "No exact authoritative record",
        detail: "CPSC evidence did not establish this claimed recall.",
        status: "unresolved",
      },
      {
        id: "NP-SAFE-001",
        title: "Sensitive request blocks action",
        detail: "Passwords and one-time codes were requested through an unverified destination.",
        status: "blocked",
      },
    ];
  if (item.expectedVerdict === "VERIFIED_RECALL_UNSAFE_CHANNEL")
    return [
      {
        id: "NP-AUTH-001",
        title: "Authoritative recall found",
        detail: "The CPSC record establishes the recall.",
        status: "pass",
      },
      {
        id: "NP-MATCH-001",
        title: "Product scope matches",
        detail: "Recall number and product scope align exactly.",
        status: "pass",
      },
      {
        id: "NP-CHANNEL-002",
        title: "Notice destination is unverified",
        detail: "The supplied domain is absent from authoritative evidence.",
        status: "fail",
      },
    ];
  return [
    {
      id: "NP-AUTH-001",
      title: "Authoritative recall found",
      detail: "CPSC recall 25-237 establishes the record.",
      status: "pass",
    },
    {
      id: "NP-MATCH-001",
      title: "Exact model and batch match",
      detail: "MZL-038 and BEDLEE220801 are inside the affected scope.",
      status: "pass",
    },
    {
      id: "NP-CHANNEL-001",
      title: "Exact contact is listed by CPSC",
      detail: "The generic Gmail address is explicitly named by Tier 1 evidence.",
      status: "pass",
    },
  ];
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatClaimValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function downloadReceipt(item: DemoCase) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          receiptVersion: "evidence-receipt/1.0.0",
          generatedFrom: "sanitized fixture",
          case: item,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.caseSlug}-evidence-receipt.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function Footer() {
  return (
    <footer>
      <a className="brand" href="#/">
        <Mark /> NoticeProof
      </a>
      <p>
        Independent evidence for a safer next step. Not legal advice or an official government
        service.
      </p>
      <span>Built for the Convex All Gas Hackathon</span>
    </footer>
  );
}

export default function App() {
  const slug = useHashRoute();
  const item = slug ? getDemoCase(slug) : undefined;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);
  return item ? <CaseView item={item} /> : <Landing />;
}
