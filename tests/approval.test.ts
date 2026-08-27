import { describe, expect, it } from "vitest";
import {
  consumeApproval,
  InvalidApprovalError,
  type ApprovalSnapshot,
} from "../shared/domain/approval";

const valid: ApprovalSnapshot = {
  state: "approved",
  verdictCode: "VERIFIED_RECALL_UNSAFE_CHANNEL",
  verdictVersion: 2,
  currentVerdictVersion: 2,
  evidenceManifestHash: "evidence-v2",
  currentEvidenceManifestHash: "evidence-v2",
  payloadHash: "a".repeat(64),
  expiresAt: 2_000,
  recipientAuthorityTier: 1,
  sourceVerifiesContact: true,
};

describe("approval protocol", () => {
  it("consumes a valid approval once", () => {
    const consumed = consumeApproval(valid, 1_000);
    expect(consumed.state).toBe("consumed");
    expect(() => consumeApproval(consumed, 1_001)).toThrow(InvalidApprovalError);
  });

  it.each([
    [{ expiresAt: 999 }, "expired"],
    [{ currentVerdictVersion: 3 }, "Verdict changed"],
    [{ currentEvidenceManifestHash: "changed" }, "Evidence changed"],
    [{ recipientAuthorityTier: 3 as const }, "not independently verified"],
    [{ sourceVerifiesContact: false }, "not independently verified"],
    [{ verdictCode: "NO_AUTHORITATIVE_EVIDENCE" as const }, "not actionable"],
  ])("blocks stale or unsafe approval %#", (patch, message) => {
    expect(() => consumeApproval({ ...valid, ...patch }, 1_000)).toThrow(message);
  });
});
