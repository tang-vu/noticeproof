import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function LiveDeploymentStatus() {
  const cases = useQuery(api.cases.listPublicDemos);
  const crawl = useQuery(api.firecrawl.crawlProgress, {});

  return (
    <section className="deployment-proof" aria-live="polite">
      <span className={cases ? "deployment-dot ready" : "deployment-dot"} aria-hidden="true" />
      <div>
        <strong>{cases ? "Convex realtime connected" : "Connecting to Convex realtime…"}</strong>
        <p>
          {cases
            ? `${cases.length} sanitized demo cases are subscribed from the Convex backend without polling.`
            : "Waiting for the first reactive case snapshot."}
        </p>
        {crawl ? (
          <p>
            Firecrawl durable crawl: {crawl.status} · {crawl.pageCount}
            {crawl.total ? `/${crawl.total}` : ""} pages · {crawl.finalized ? "finalized" : "live"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
