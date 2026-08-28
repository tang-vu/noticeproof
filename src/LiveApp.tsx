import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import App from "./App";
import { LiveDeploymentStatus } from "./LiveDeploymentStatus";

function LiveCase({ publicId }: { publicId: string }) {
  const capabilityToken = sessionStorage.getItem(`noticeproof:cap:${publicId}`) ?? undefined;
  const createDraft = useMutation(api.approvals.createDraft);
  const approveAndSend = useMutation(api.approvals.approveAndSend);
  const rejectDraft = useMutation(api.approvals.rejectDraft);
  const [subject, setSubject] = useState("Request for verified recall remedy instructions");
  const [body, setBody] = useState(
    "Please confirm the next steps and identifiers required for this recall remedy.",
  );
  const [actionStatus, setActionStatus] = useState("");
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
  const sourceById = new Map(result.sources.map((source) => [source._id, source]));
  const verifiedSource = result.sources.find(
    (source) => source.verifiesContact && source.verifiedEmail,
  );
  const pendingApproval = result.approvals.find((approval) => approval.state === "pending");

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
                            "Send is still blocked: AgentMail production credentials are not configured.",
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
  const createPasted = useMutation(api.cases.createPasted);
  const generateScreenshotUploadUrl = useMutation(api.cases.generateScreenshotUploadUrl);
  const createScreenshot = useMutation(api.cases.createScreenshot);
  const startExtraction = useMutation(api.extraction.start);

  return (
    <App
      liveStatus={<LiveDeploymentStatus />}
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
