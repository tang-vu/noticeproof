import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary, NetworkStatus } from "../src/ReliabilityShell";

function BrokenView(): never {
  throw new Error("private runtime detail");
}

function ExpiredView(): never {
  throw new Error("[CONVEX] CASE_EXPIRED with private metadata");
}

afterEach(cleanup);

describe("application reliability shell", () => {
  it("turns a render failure into a safe, actionable recovery state", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No safety verdict was inferred");
    expect(screen.queryByText("private runtime detail")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("explains an expired capability without exposing the raw server error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <ExpiredView />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("capability reached its retention limit");
    expect(screen.queryByText(/private metadata/)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("announces offline state and clears it when connectivity returns", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<NetworkStatus />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "verification and safe actions are paused",
    );
    fireEvent(window, new Event("online"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
