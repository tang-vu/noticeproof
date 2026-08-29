import { Component, useEffect, useState, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type RecoveryReason = "expired" | "missing_capability" | "unknown";
type ErrorBoundaryState = { failed: boolean; reason: RecoveryReason };

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, reason: "unknown" };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : "";
    return {
      failed: true,
      reason: message.includes("CASE_EXPIRED")
        ? "expired"
        : message.includes("CASE_ACCESS_DENIED")
          ? "missing_capability"
          : "unknown",
    };
  }

  componentDidCatch() {
    // Deliberately avoid forwarding error objects: Convex errors may contain case metadata.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const copy =
      this.state.reason === "expired"
        ? {
            eyebrow: "Private link expired",
            title: "This case is no longer accessible.",
            body: "The capability reached its retention limit and was revoked server-side. Start a new verification if you still need current evidence.",
          }
        : this.state.reason === "missing_capability"
          ? {
              eyebrow: "Capability required",
              title: "Open this case from its original browser session.",
              body: "NoticeProof cannot recover or email private capability tokens. Return home to start a new verification if the original session is unavailable.",
            }
          : {
              eyebrow: "Safe recovery",
              title: "This evidence view could not be loaded.",
              body: "No safety verdict was inferred from the failure. Check your connection, then retry the current case or return to the sanitized demos.",
            };
    return (
      <main className="recovery-shell">
        <section className="recovery-card" role="alert" aria-labelledby="recovery-title">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="recovery-title">{copy.title}</h1>
          <p>{copy.body}</p>
          <div className="recovery-actions">
            <button className="button primary" type="button" onClick={() => location.reload()}>
              Retry this view
            </button>
            <a className="button secondary" href="/">
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}

export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div className="network-status" role="status" aria-live="polite">
      You are offline. Stored content remains visible, but verification and safe actions are paused.
    </div>
  );
}
