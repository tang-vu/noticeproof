import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function LiveDeploymentStatus() {
  const cases = useQuery(api.cases.listPublicDemos);
  const crawl = useQuery(api.firecrawl.crawlProgress, {});
  const proofs = useQuery(api.integrationProofs.listPublic);

  return (
    <section className="deployment-proof" aria-live="polite" aria-labelledby="proof-title">
      <div className="deployment-proof-heading">
        <div>
          <p className="eyebrow">Live deployment proof</p>
          <strong id="proof-title">
            {cases ? "Sponsor systems verified in this deployment" : "Connecting to live proof…"}
          </strong>
        </div>
        <span className="proof-live-badge">
          <i className={cases ? "deployment-dot ready" : "deployment-dot"} aria-hidden="true" />
          Convex realtime
        </span>
      </div>
      <p className="deployment-proof-intro">
        {cases
          ? `${cases.length} sanitized demos and privacy-safe integration milestones are subscribed without browser polling.`
          : "Waiting for the first reactive deployment snapshot."}
      </p>
      <div className="integration-proof-grid">
        <article>
          <span>Convex</span>
          <strong>Realtime case state connected</strong>
          <small>Typed queries · subscriptions · no polling</small>
        </article>
        {proofs?.map((proof) => (
          <article key={proof._id}>
            <span>{proof.sponsor}</span>
            <strong>{proof.milestone}</strong>
            <small>{proof.detail}</small>
            <time dateTime={new Date(proof.verifiedAt).toISOString()}>
              Verified {new Date(proof.verifiedAt).toLocaleDateString()}
            </time>
          </article>
        ))}
        {crawl ? (
          <article>
            <span>Firecrawl</span>
            <strong>Durable crawl {crawl.status}</strong>
            <small>
              {crawl.pageCount}
              {crawl.total ? `/${crawl.total}` : ""} pages ·{" "}
              {crawl.finalized ? "finalized" : "live"}
            </small>
          </article>
        ) : null}
      </div>
      <p className="proof-privacy-note">
        This panel exposes milestone type and time only—never private messages, recipients, case
        identifiers, or API responses.
      </p>
    </section>
  );
}
