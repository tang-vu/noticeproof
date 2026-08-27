import { describe, expect, it } from "vitest";
import { CASE_STATES } from "../shared/domain/constants";
import {
  allowedTransitions,
  assertTransition,
  InvalidCaseTransitionError,
} from "../shared/domain/stateMachine";

describe("case state machine", () => {
  it("defines transitions for every state", () => {
    expect(Object.keys(allowedTransitions).sort()).toEqual([...CASE_STATES].sort());
  });

  it.each([
    ["RECEIVED", "EXTRACTING_CLAIMS"],
    ["EVALUATING", "ACTIONABLE"],
    ["ACTIONABLE", "AWAITING_APPROVAL"],
    ["AWAITING_APPROVAL", "CONTACTING_VERIFIED_CHANNEL"],
    ["AWAITING_REPLY", "REMEDY_CONFIRMED"],
    ["REMEDY_CONFIRMED", "RESOLVED"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ["RECEIVED", "RESOLVED"],
    ["EVALUATING", "AWAITING_REPLY"],
    ["AWAITING_APPROVAL", "RESOLVED"],
    ["RESOLVED", "RECEIVED"],
  ] as const)("rejects %s → %s transactionally", (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(InvalidCaseTransitionError);
  });
});
