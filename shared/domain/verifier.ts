import { RULE_ENGINE_VERSION, type AuthorityTier, type VerdictCode } from "./constants";

export type VerificationFact = {
  id: string;
  tier: AuthorityTier;
  relation: "supports" | "contradicts" | "narrows" | "unresolved";
  claimType: string;
  ruleId: string;
};

export type VerificationInput = {
  authoritativeRecallFound: boolean;
  exactRecallIdMatch: boolean;
  exactProductMatch: boolean;
  matchCriticalIdentifierPresent: boolean;
  noticeChannelMatchesVerifiedChannel: boolean;
  verifiedContactAvailable: boolean;
  unsafeSensitiveRequest: boolean;
  externalFailure: boolean;
  facts: VerificationFact[];
};

export type RuleResult = {
  ruleId: string;
  outcome: "pass" | "fail" | "blocked" | "unresolved";
  evidenceIds: string[];
};

export type DeterministicVerdict = {
  code: VerdictCode;
  ruleEngineVersion: string;
  rules: RuleResult[];
  eligibleActions: string[];
  blockingReasons: string[];
  missingIdentifiers: string[];
};

const idsFor = (facts: VerificationFact[], relation?: VerificationFact["relation"]) =>
  facts.filter((fact) => !relation || fact.relation === relation).map((fact) => fact.id);

export function verifyNotice(input: VerificationInput): DeterministicVerdict {
  const rules: RuleResult[] = [];
  if (input.externalFailure) {
    rules.push({ ruleId: "NP-EXT-001", outcome: "unresolved", evidenceIds: [] });
    return result(
      "VERIFICATION_FAILED_RETRYABLE",
      rules,
      [],
      ["Verification services are temporarily unavailable."],
      [],
    );
  }
  rules.push({
    ruleId: "NP-AUTH-001",
    outcome: input.authoritativeRecallFound ? "pass" : "unresolved",
    evidenceIds: idsFor(input.facts),
  });
  if (!input.authoritativeRecallFound) {
    const conflict = input.unsafeSensitiveRequest;
    if (conflict)
      rules.push({
        ruleId: "NP-SAFE-001",
        outcome: "blocked",
        evidenceIds: idsFor(input.facts, "contradicts"),
      });
    return result(
      conflict ? "CONFLICTING_NOTICE" : "NO_AUTHORITATIVE_EVIDENCE",
      rules,
      [],
      [
        conflict
          ? "The notice requests sensitive action through an unverified channel."
          : "No matching authoritative CPSC evidence was found.",
      ],
      [],
    );
  }
  if (!input.matchCriticalIdentifierPresent || !input.exactProductMatch) {
    rules.push({
      ruleId: "NP-MATCH-002",
      outcome: "unresolved",
      evidenceIds: idsFor(input.facts, "narrows"),
    });
    return result(
      "POSSIBLE_MATCH_NEEDS_IDENTIFIER",
      rules,
      [],
      ["An exact product identifier is required."],
      ["model, lot, serial, UPC, or affected date"],
    );
  }
  rules.push({
    ruleId: "NP-MATCH-001",
    outcome: "pass",
    evidenceIds: idsFor(input.facts, "supports"),
  });
  if (input.unsafeSensitiveRequest) {
    rules.push({
      ruleId: "NP-SAFE-001",
      outcome: "blocked",
      evidenceIds: idsFor(input.facts, "contradicts"),
    });
    return result(
      "CONFLICTING_NOTICE",
      rules,
      [],
      ["The notice requests sensitive action through an unverified channel."],
      [],
    );
  }
  if (!input.noticeChannelMatchesVerifiedChannel) {
    rules.push({
      ruleId: "NP-CHANNEL-002",
      outcome: "fail",
      evidenceIds: idsFor(input.facts, "contradicts"),
    });
    return result(
      "VERIFIED_RECALL_UNSAFE_CHANNEL",
      rules,
      input.verifiedContactAvailable ? ["START_VERIFIED_EMAIL"] : [],
      input.verifiedContactAvailable
        ? []
        : ["No independently verified email contact is available."],
      [],
    );
  }
  rules.push({
    ruleId: "NP-CHANNEL-001",
    outcome: "pass",
    evidenceIds: idsFor(input.facts, "supports"),
  });
  return result(
    "VERIFIED_OFFICIAL_CHANNEL",
    rules,
    input.verifiedContactAvailable ? ["START_VERIFIED_EMAIL"] : [],
    input.verifiedContactAvailable
      ? []
      : ["The notice is verified, but the remedy is not available by verified email."],
    [],
  );
}

function result(
  code: VerdictCode,
  rules: RuleResult[],
  eligibleActions: string[],
  blockingReasons: string[],
  missingIdentifiers: string[],
): DeterministicVerdict {
  return {
    code,
    ruleEngineVersion: RULE_ENGINE_VERSION,
    rules,
    eligibleActions,
    blockingReasons,
    missingIdentifiers,
  };
}
