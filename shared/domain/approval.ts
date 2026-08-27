import type { AuthorityTier, VerdictCode } from "./constants";

export type ApprovalSnapshot = {
  state: "pending" | "approved" | "rejected" | "expired" | "consumed";
  verdictCode: VerdictCode;
  verdictVersion: number;
  currentVerdictVersion: number;
  evidenceManifestHash: string;
  currentEvidenceManifestHash: string;
  payloadHash: string;
  expiresAt: number;
  recipientAuthorityTier: AuthorityTier;
  sourceVerifiesContact: boolean;
};

export class InvalidApprovalError extends Error {
  readonly code = "INVALID_APPROVAL";
  constructor(message: string) {
    super(message);
    this.name = "InvalidApprovalError";
  }
}

export function assertApprovalCanBeConsumed(approval: ApprovalSnapshot, now: number): void {
  if (approval.state !== "approved")
    throw new InvalidApprovalError("Approval is not approved or was already consumed");
  if (approval.expiresAt <= now) throw new InvalidApprovalError("Approval has expired");
  if (approval.verdictVersion !== approval.currentVerdictVersion)
    throw new InvalidApprovalError("Verdict changed after approval");
  if (approval.evidenceManifestHash !== approval.currentEvidenceManifestHash)
    throw new InvalidApprovalError("Evidence changed after approval");
  if (!approval.sourceVerifiesContact || approval.recipientAuthorityTier > 2)
    throw new InvalidApprovalError("Recipient is not independently verified");
  if (
    approval.verdictCode !== "VERIFIED_OFFICIAL_CHANNEL" &&
    approval.verdictCode !== "VERIFIED_RECALL_UNSAFE_CHANNEL"
  ) {
    throw new InvalidApprovalError("Verdict is not actionable");
  }
  if (!/^[a-f0-9]{64}$/i.test(approval.payloadHash))
    throw new InvalidApprovalError("Payload hash is invalid");
}

export function consumeApproval(approval: ApprovalSnapshot, now: number) {
  assertApprovalCanBeConsumed(approval, now);
  return { ...approval, state: "consumed" as const, consumedAt: now };
}
