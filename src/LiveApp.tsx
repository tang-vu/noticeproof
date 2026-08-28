import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import App from "./App";
import { LiveDeploymentStatus } from "./LiveDeploymentStatus";

function LiveCase({ publicId }: { publicId: string }) {
  const capabilityToken = sessionStorage.getItem(`noticeproof:cap:${publicId}`) ?? undefined;
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
        <section className="live-panel">
          <p className="eyebrow">Submitted notice</p>
          <h2>{result.notices[0]?.subject ?? "Notice received"}</h2>
          <p>{result.notices[0]?.bodyPreview}</p>
        </section>
        <section className="live-panel">
          <p className="eyebrow">Evidence</p>
          <h2>{result.sources.length} authoritative sources</h2>
          {result.sources.length ? (
            result.sources.map((source) => (
              <p key={source._id}>
                Tier {source.authorityTier} · {source.canonicalDomain} · {source.status}
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
      </div>
    </main>
  );
}

export function LiveApp() {
  const createPasted = useMutation(api.cases.createPasted);
  const startExtraction = useMutation(api.extraction.start);

  return (
    <App
      liveStatus={<LiveDeploymentStatus />}
      onSubmitNotice={async (body) => {
        const created = await createPasted({
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
