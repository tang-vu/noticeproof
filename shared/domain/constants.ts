export const CASE_STATES = [
  "RECEIVED",
  "EXTRACTING_CLAIMS",
  "CLAIMS_READY",
  "ACQUIRING_EVIDENCE",
  "EVALUATING",
  "ACTIONABLE",
  "NEEDS_IDENTIFIER",
  "BLOCKED_CONFLICT",
  "NO_AUTHORITATIVE_EVIDENCE",
  "VERIFICATION_FAILED_RETRYABLE",
  "AWAITING_APPROVAL",
  "CONTACTING_VERIFIED_CHANNEL",
  "AWAITING_REPLY",
  "REMEDY_CONFIRMED",
  "RESOLVED",
  "CLOSED_UNRESOLVED",
] as const;

export type CaseState = (typeof CASE_STATES)[number];

export const VERDICT_CODES = [
  "VERIFIED_OFFICIAL_CHANNEL",
  "VERIFIED_RECALL_UNSAFE_CHANNEL",
  "POSSIBLE_MATCH_NEEDS_IDENTIFIER",
  "CONFLICTING_NOTICE",
  "NO_AUTHORITATIVE_EVIDENCE",
  "VERIFICATION_FAILED_RETRYABLE",
] as const;

export type VerdictCode = (typeof VERDICT_CODES)[number];

export const INPUT_KINDS = ["forwarded_email", "pasted_text", "screenshot", "seeded_demo"] as const;

export const REMEDY_TYPES = [
  "refund",
  "repair",
  "replace",
  "dispose",
  "new_instructions",
  "unknown",
] as const;
export type RemedyType = (typeof REMEDY_TYPES)[number];

export const AUTHORITY_TIERS = [1, 2, 3, 4] as const;
export type AuthorityTier = (typeof AUTHORITY_TIERS)[number];

export const RULE_ENGINE_VERSION = "noticeproof-rules/1.0.0";
export const CLAIM_SCHEMA_VERSION = "claim-envelope/1.0.0";
export const RECEIPT_VERSION = "evidence-receipt/1.0.0";
