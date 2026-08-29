import { Component, useEffect, useState, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { failed: boolean };

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    // Deliberately avoid forwarding error objects: Convex errors may contain case metadata.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recovery-shell">
        <section className="recovery-card" role="alert" aria-labelledby="recovery-title">
          <p className="eyebrow">Safe recovery</p>
          <h1 id="recovery-title">This evidence view could not be loaded.</h1>
          <p>
            No safety verdict was inferred from the failure. Check your connection, then retry the
            current case or return to the sanitized demos.
          </p>
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
