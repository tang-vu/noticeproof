import { v } from "convex/values";

export const caseState = v.union(
  v.literal("RECEIVED"),
  v.literal("EXTRACTING_CLAIMS"),
  v.literal("CLAIMS_READY"),
  v.literal("ACQUIRING_EVIDENCE"),
  v.literal("EVALUATING"),
  v.literal("ACTIONABLE"),
  v.literal("NEEDS_IDENTIFIER"),
  v.literal("BLOCKED_CONFLICT"),
  v.literal("NO_AUTHORITATIVE_EVIDENCE"),
  v.literal("VERIFICATION_FAILED_RETRYABLE"),
  v.literal("AWAITING_APPROVAL"),
  v.literal("CONTACTING_VERIFIED_CHANNEL"),
  v.literal("AWAITING_REPLY"),
  v.literal("REMEDY_CONFIRMED"),
  v.literal("RESOLVED"),
  v.literal("CLOSED_UNRESOLVED"),
);

export const verdictCode = v.union(
  v.literal("VERIFIED_OFFICIAL_CHANNEL"),
  v.literal("VERIFIED_RECALL_UNSAFE_CHANNEL"),
  v.literal("POSSIBLE_MATCH_NEEDS_IDENTIFIER"),
  v.literal("CONFLICTING_NOTICE"),
  v.literal("NO_AUTHORITATIVE_EVIDENCE"),
  v.literal("VERIFICATION_FAILED_RETRYABLE"),
);

export const inputKind = v.union(
  v.literal("forwarded_email"),
  v.literal("pasted_text"),
  v.literal("screenshot"),
  v.literal("seeded_demo"),
);

export const noticeType = v.union(
  v.literal("recall"),
  v.literal("safety_warning"),
  v.literal("unknown"),
);
export const remedyType = v.union(
  v.literal("refund"),
  v.literal("repair"),
  v.literal("replace"),
  v.literal("dispose"),
  v.literal("new_instructions"),
  v.literal("unknown"),
);

export const riskLevel = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("unknown"),
);
export const authorityTier = v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4));
export const evidenceRelation = v.union(
  v.literal("supports"),
  v.literal("contradicts"),
  v.literal("narrows"),
  v.literal("unresolved"),
);
export const approvalState = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("consumed"),
);
export const sourceSpan = v.object({ start: v.number(), end: v.number(), quote: v.string() });
