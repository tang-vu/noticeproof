import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import App from "./App";
import { LiveDeploymentStatus } from "./LiveDeploymentStatus";

function downloadLiveReceipt(publicId: string, machineJson: string) {
  const blob = new Blob([JSON.stringify(JSON.parse(machineJson) as unknown, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${publicId}-evidence-receipt.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function AgentMailDelivery({
  publicId,
  capabilityToken,
  outboundId,
  intendedRecipient,
  actualRecipient,
}: {
  publicId: string;
  capabilityToken?: string;
  outboundId: string;
  intendedRecipient?: string;
  actualRecipient?: string;
}) {
  const status = useQuery(api.approvals.sendStatus, {
    publicId,
    ...(capabilityToken ? { capabilityToken } : {}),
    outboundId,
  });

  return (
    <section className="live-panel live-delivery-panel" aria-live="polite">
      <p className="eyebrow">AgentMail delivery · realtime</p>
      <h2>{status?.status?.toUpperCase() ?? "QUEUED"}</h2>
      <p>
        Intended verified channel: <strong>{intendedRecipient ?? "Unavailable"}</strong>
      </p>
      {actualRecipient && actualRecipient !== intendedRecipient ? (
        <p className="demo-routing-note">
          Demo delivery destination: <strong>{actualRecipient}</strong>
        </p>
      ) : null}
      <small>
        {status?.threadId
          ? `Thread ${status.threadId}`
          : "Waiting for AgentMail to assign the trusted thread."}
      </small>
      {status?.errorMessage ? <p role="alert">Delivery error: {status.errorMessage}</p> : null}
    </section>
  );
}

function LiveCase({ publicId }: { publicId: string }) {
  const capabilityToken = sessionStorage.getItem(`noticeproof:cap:${publicId}`) ?? undefined;
  const createDraft = useMutation(api.approvals.createDraft);
  const approveAndSend = useMutation(api.approvals.approveAndSend);
  const rejectDraft = useMutation(api.approvals.rejectDraft);
  const retryExtraction = useMutation(api.extraction.start);
  const updateResolution = useMutation(api.cases.updateResolution);
  const [subject, setSubject] = useState("Request for verified recall remedy instructions");
  const [body, setBody] = useState(
    "Please confirm the next steps and identifiers required for this recall remedy.",
  );
  const [actionStatus, setActionStatus] = useState("");
  const forwardingSubject =
    sessionStorage.getItem(`noticeproof:forwarding:${publicId}`) ?? undefined;
  const forwardingInbox = import.meta.env.VITE_AGENTMAIL_FORWARDING_ADDRESS?.trim();
  const result = useQuery(api.cases.get, {
    publicId,
    ...(capabilityToken ? { capabilityToken } : {}),
  });

  if (!result) {
    return (
      <main className="live-case-shell">
        <div className="live-case-loading" role="status">
          <span className="deployment-dot" /> Verifying capability and subscribing to case state…
        </div>
      </main>
    );
  }

  const verdict = result.verdicts[0];
  const explanation = verdict
    ? result.verdictExplanations.find((item) => item.verdictId === verdict._id)
    : undefined;
  const sourceById = new Map(result.sources.map((source) => [source._id, source]));
  const verifiedSource = result.sources.find(
    (source) => source.verifiesContact && source.verifiedEmail,
  );
  const pendingApproval = result.approvals.find((approval) => approval.state === "pending");
  const outboundCommunication = result.communications.find(
    (communication) => communication.direction === "outbound" && communication.outboundId,
  );
  const latestReceipt = result.evidenceReceipts[0];

  return (
    <main className="live-case-shell">
      <a className="live-case-back" href="#/">
        ← NoticeProof intake
      </a>
      <section className="live-case-hero">
        <p className="eyebrow">Live Convex case · {result.case.publicId}</p>
        <h1>{result.case.nextAction}</h1>
        <div className="live-state-row">
          <span className="deployment-dot ready" />
          <strong>{result.case.currentState.replaceAll("_", " ")}</strong>
          <span>Updated {new Date(result.case.updatedAt).toLocaleTimeString()}</span>
        </div>
        <p>
          This view is capability-scoped and reactive. A missing integration becomes a retryable
          system state, never a safety verdict.
        </p>
      </section>
      {result.case.inputKind === "forwarded_email" &&
      result.notices.length === 0 &&
      forwardingSubject ? (
        <section className="live-forward-guide" aria-labelledby="forward-now-title">
          <div>
            <p className="eyebrow">One-time tracked forwarding</p>
            <h2 id="forward-now-title">Forward the notice, then watch this case update live.</h2>
            <p>
              Send it to the AgentMail inbox and replace the subject with the exact private subject
              below. Keep this tab open—Convex will update it without polling.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <small>TO</small>
                <strong>{forwardingInbox ?? "AgentMail inbox unavailable"}</strong>
              </div>
              <button
                type="button"
                disabled={!forwardingInbox}
                onClick={() => void navigator.clipboard.writeText(forwardingInbox ?? "")}
              >
                Copy
              </button>
            </li>
            <li>
              <span>2</span>
              <div>
                <small>SUBJECT — COPY EXACTLY</small>
                <strong>{forwardingSubject}</strong>
              </div>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(forwardingSubject)}
              >
                Copy
              </button>
            </li>
          </ol>
          <p className="forward-expiry-note">
            The one-time match code expires in 24 hours. It is not the capability that unlocks this
            case.
          </p>
        </section>
      ) : null}
      {result.case.currentState === "VERIFICATION_FAILED_RETRYABLE" ? (
        <section className="live-retry-panel" role="alert">
          <div>
            <p className="eyebrow">Temporary verification failure</p>
            <h2>No safety conclusion was produced.</h2>
            <p>
              Retry starts a new bounded extraction and evidence pass. Existing timeline events
              remain append-only.
            </p>
            {actionStatus ? <p role="status">{actionStatus}</p> : null}
          </div>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setActionStatus("Retrying bounded verification…");
              void retryExtraction({
                publicId,
                ...(capabilityToken ? { capabilityToken } : {}),
              })
                .then(() => setActionStatus("Verification retry started."))
                .catch(() => setActionStatus("Retry remains unavailable. Please try again later."));
            }}
          >
            Retry verification
          </button>
        </section>
      ) : null}
      <div className="live-case-grid">
        {verdict ? (
          <section className="live-panel live-verdict-panel">
            <p className="eyebrow">Deterministic verdict · v{verdict.version}</p>
            <h2>{verdict.code.replaceAll("_", " ")}</h2>
            <p>{verdict.summary}</p>
            <div className="live-rule-list">
              {verdict.ruleResults.map((rule) => (
                <span key={rule.ruleId} data-outcome={rule.outcome}>
                  {rule.ruleId} · {rule.outcome}
                </span>
              ))}
            </div>
            {explanation ? (
              <div className="bounded-explanation">
                <span>OpenAI-assisted · bounded to stored rules</span>
                <p>{explanation.text}</p>
                <small>
                  References {explanation.referencedRuleIds.join(" · ") || "the verdict rule set"}.
                  AI cannot alter the verdict, evidence, recipient, or action eligibility.
                </small>
              </div>
            ) : (
              <p className="explanation-pending">
                The deterministic result is complete. A bounded consumer explanation may arrive
                separately.
              </p>
            )}
          </section>
        ) : null}
        <section className="live-panel">
          <p className="eyebrow">Submitted notice</p>
          <h2>{result.notices[0]?.subject ?? "Notice received"}</h2>
          <p>{result.notices[0]?.bodyPreview}</p>
        </section>
        <section className="live-panel">
          <p className="eyebrow">Claim ledger</p>
          <h2>{result.claims.length} material claims</h2>
          {result.claims.length ? (
            <ul className="live-claim-list">
              {result.claims.map((claim) => {
                const edges = result.evidenceEdges.filter((edge) => edge.claimId === claim._id);
                return (
                  <li key={claim._id}>
                    <span>{claim.claimType.replaceAll("_", " ")}</span>
                    <strong>{claim.normalizedValue}</strong>
                    <small>
                      {edges.length
                        ? edges
                            .map((edge) => {
                              const source = sourceById.get(edge.sourceId);
                              return `${edge.relation} · ${source?.canonicalDomain ?? "source"}`;
                            })
                            .join(" · ")
                        : "Awaiting exact evidence alignment"}
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Claim extraction is still pending.</p>
          )}
        </section>
        <section className="live-panel">
          <p className="eyebrow">Evidence</p>
          <h2>{result.sources.length} authoritative sources</h2>
          {result.sources.length ? (
            result.sources.map((source) => (
              <p key={source._id}>
                Tier {source.authorityTier} · {source.canonicalDomain} · {source.status}
                {source.contentHash ? ` · ${source.contentHash.slice(0, 12)}…` : ""}
              </p>
            ))
          ) : (
            <p>No evidence has arrived yet. Absence of evidence is not a safety result.</p>
          )}
        </section>
        <section className="live-panel timeline-panel">
          <p className="eyebrow">Reactive timeline</p>
          <h2>Events arrive without polling</h2>
          <ol>
            {result.timeline.map((event) => (
              <li key={event._id}>
                <strong>{event.summary}</strong>
                <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ol>
        </section>
        {latestReceipt ? (
          <section className="live-panel live-receipt-panel">
            <div>
              <p className="eyebrow">Append-only evidence receipt</p>
              <h2>Reproduce what NoticeProof knew</h2>
              <p>{latestReceipt.humanSummary}</p>
            </div>
            <dl>
              <div>
                <dt>Claim envelope</dt>
                <dd>{latestReceipt.claimEnvelopeHash.slice(0, 16)}…</dd>
              </div>
              <div>
                <dt>Evidence manifest</dt>
                <dd>{latestReceipt.evidenceManifestHash.slice(0, 16)}…</dd>
              </div>
              <div>
                <dt>Verdict</dt>
                <dd>{latestReceipt.verdictHash.slice(0, 16)}…</dd>
              </div>
              <div>
                <dt>Timeline</dt>
                <dd>{latestReceipt.timelineHash.slice(0, 16)}…</dd>
              </div>
              {latestReceipt.approvalHash ? (
                <div>
                  <dt>Consumed approval</dt>
                  <dd>{latestReceipt.approvalHash.slice(0, 16)}…</dd>
                </div>
              ) : null}
            </dl>
            <button
              className="button secondary"
              type="button"
              onClick={() => downloadLiveReceipt(publicId, latestReceipt.machineJson)}
            >
              Download machine-readable JSON ↓
            </button>
            <small>
              Raw notice text, capability tokens, outbound payloads, and demo destinations are
              excluded.
            </small>
          </section>
        ) : null}
        {outboundCommunication?.outboundId ? (
          <AgentMailDelivery
            publicId={publicId}
            {...(capabilityToken ? { capabilityToken } : {})}
            outboundId={outboundCommunication.outboundId}
            {...(outboundCommunication.intendedRecipient
              ? { intendedRecipient: outboundCommunication.intendedRecipient }
              : {})}
            {...(outboundCommunication.actualRecipient
              ? { actualRecipient: outboundCommunication.actualRecipient }
              : {})}
          />
        ) : null}
        {result.communications.length ? (
          <section className="live-panel live-thread-panel" aria-live="polite">
            <p className="eyebrow">Trusted AgentMail thread</p>
            <h2>{result.communications.length} messages and delivery events</h2>
            <ol className="live-communication-list">
              {[...result.communications].reverse().map((communication) => (
                <li key={communication._id}>
                  <div>
                    <strong>
                      {communication.direction === "inbound" ? "Reply received" : "Sent"}
                    </strong>
                    <span>{communication.deliveryState.toUpperCase()}</span>
                  </div>
                  <p>{communication.redactedSummary}</p>
                  <small>{new Date(communication.createdAt).toLocaleTimeString()}</small>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {result.case.currentState === "AWAITING_REPLY" ||
        result.case.currentState === "REMEDY_CONFIRMED" ? (
          <section className="live-panel live-resolution-panel">
            <p className="eyebrow">Human-confirmed closure</p>
            <h2>
              {result.case.currentState === "AWAITING_REPLY"
                ? "Did you receive usable remedy instructions?"
                : "Is your own remedy process complete?"}
            </h2>
            <p>
              NoticeProof records your declaration only. A sent email or received reply never proves
              that a refund, repair, replacement, return, or disposal was completed.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                const action =
                  result.case.currentState === "AWAITING_REPLY" ? "confirm_remedy" : "resolve";
                setActionStatus("Recording your confirmation in the append-only timeline…");
                void updateResolution({
                  publicId,
                  ...(capabilityToken ? { capabilityToken } : {}),
                  action,
                })
                  .then(() => setActionStatus("Your confirmation was recorded with a new receipt."))
                  .catch(() =>
                    setActionStatus("The case state changed. Review it before retrying."),
                  );
              }}
            >
              {result.case.currentState === "AWAITING_REPLY"
                ? "Confirm instructions received"
                : "Mark my case resolved"}
            </button>
            {actionStatus ? (
              <p className="form-status" role="status">
                {actionStatus}
              </p>
            ) : null}
          </section>
        ) : null}
        {verifiedSource &&
        (result.case.currentState === "ACTIONABLE" ||
          result.case.currentState === "AWAITING_APPROVAL") ? (
          <section className="live-panel live-action-panel">
            <p className="eyebrow">Safe channel switch</p>
            <h2>New thread to {verifiedSource.verifiedEmail}</h2>
            <p>
              Verified by Tier {verifiedSource.authorityTier} evidence at{" "}
              <strong>{verifiedSource.canonicalDomain}</strong>. NoticeProof never replies to the
              original sender by default.
            </p>
            {pendingApproval ? (
              <div className="approval-preview">
                <div>
                  <span>Intended recipient</span>
                  <strong>{pendingApproval.intendedRecipient}</strong>
                </div>
                {pendingApproval.actualRecipient !== pendingApproval.intendedRecipient ? (
                  <div className="demo-routing-note">
                    Demo mode routes delivery to <strong>{pendingApproval.actualRecipient}</strong>.
                  </div>
                ) : null}
                <pre>{pendingApproval.redactedPreview}</pre>
                <small>
                  Bound to verdict v{pendingApproval.verdictVersion} · expires{" "}
                  {new Date(pendingApproval.expiresAt).toLocaleTimeString()}
                </small>
                <div className="approval-actions">
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => {
                      setActionStatus("Approving the exact payload and queueing AgentMail…");
                      void approveAndSend({
                        publicId,
                        ...(capabilityToken ? { capabilityToken } : {}),
                        approvalId: pendingApproval._id,
                        payloadHash: pendingApproval.payloadHash,
                      })
                        .then(() => setActionStatus("AgentMail queued the verified new thread."))
                        .catch(() =>
                          setActionStatus(
                            "Send remains safely blocked. Refresh the case or retry after checking the current evidence.",
                          ),
                        );
                    }}
                  >
                    Approve exact payload
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      void rejectDraft({
                        publicId,
                        ...(capabilityToken ? { capabilityToken } : {}),
                        approvalId: pendingApproval._id,
                      });
                    }}
                  >
                    Cancel without sending
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="live-draft-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setActionStatus("Binding preview to the current evidence and verdict…");
                  void createDraft({
                    publicId,
                    ...(capabilityToken ? { capabilityToken } : {}),
                    verifiedRecipientSourceId: verifiedSource._id,
                    intendedRecipient: verifiedSource.verifiedEmail!,
                    subject,
                    body,
                  })
                    .then(() => setActionStatus("Preview ready for explicit approval."))
                    .catch(() => setActionStatus("Draft was blocked by the safe-action policy."));
                }}
              >
                <label>
                  Subject
                  <input
                    value={subject}
                    maxLength={200}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label>
                  Message
                  <textarea
                    value={body}
                    maxLength={10000}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <button className="button primary" type="submit">
                  Review exact payload
                </button>
              </form>
            )}
            <p className="form-status" role="status">
              {actionStatus}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export function LiveApp() {
  const createForwardingSession = useMutation(api.cases.createForwardingSession);
  const createPasted = useMutation(api.cases.createPasted);
  const generateScreenshotUploadUrl = useMutation(api.cases.generateScreenshotUploadUrl);
  const createScreenshot = useMutation(api.cases.createScreenshot);
  const startExtraction = useMutation(api.extraction.start);

  return (
    <App
      liveStatus={<LiveDeploymentStatus />}
      onPrepareForwarding={async () => await createForwardingSession({})}
      onSubmitNotice={async (body, screenshot) => {
        const created = screenshot
          ? await (async () => {
              const uploadUrl = await generateScreenshotUploadUrl({});
              const uploadResponse = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": screenshot.type },
                body: screenshot,
              });
              if (!uploadResponse.ok) throw new Error("SCREENSHOT_UPLOAD_FAILED");
              const payload = (await uploadResponse.json()) as { storageId?: unknown };
              if (typeof payload.storageId !== "string") throw new Error("STORAGE_ID_MISSING");
              return await createScreenshot({
                storageId: payload.storageId as Id<"_storage">,
                fileName: screenshot.name,
                mediaType: screenshot.type,
                size: screenshot.size,
                ...(body.trim() ? { accompanyingText: body } : {}),
              });
            })()
          : await createPasted({
              subject: "Pasted recall notice",
              sender: "Sender not provided",
              body,
            });
        await startExtraction({
          publicId: created.publicId,
          capabilityToken: created.capabilityToken,
        });
        return created;
      }}
      renderLiveCase={(publicId) => <LiveCase publicId={publicId} />}
    />
  );
}
