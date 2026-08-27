import { describe, expect, it } from "vitest";
import fraudulent from "../fixtures/v1/synthetic-fraudulent-notice.json";
import unsafe from "../fixtures/v1/real-recall-unsafe-channel.json";
import official from "../fixtures/v1/verified-official-channel.json";
import { verifyNotice, type VerificationInput } from "../shared/domain/verifier";

const fixtures = [fraudulent, unsafe, official] as const;

describe("deterministic verifier", () => {
  it.each(fixtures)("selects $expectedVerdict for $caseSlug", (fixture) => {
    const verdict = verifyNotice(fixture.verificationInput as VerificationInput);
    expect(verdict.code).toBe(fixture.expectedVerdict);
  });

  it("never turns no evidence into safe", () => {
    const verdict = verifyNotice({
      authoritativeRecallFound: false,
      exactRecallIdMatch: false,
      exactProductMatch: false,
      matchCriticalIdentifierPresent: false,
      noticeChannelMatchesVerifiedChannel: true,
      verifiedContactAvailable: true,
      unsafeSensitiveRequest: false,
      externalFailure: false,
      facts: [],
    });
    expect(verdict.code).toBe("NO_AUTHORITATIVE_EVIDENCE");
    expect(verdict.eligibleActions).toEqual([]);
  });

  it("requires an exact match-critical identifier", () => {
    const verdict = verifyNotice({
      authoritativeRecallFound: true,
      exactRecallIdMatch: true,
      exactProductMatch: false,
      matchCriticalIdentifierPresent: false,
      noticeChannelMatchesVerifiedChannel: true,
      verifiedContactAvailable: true,
      unsafeSensitiveRequest: false,
      externalFailure: false,
      facts: [],
    });
    expect(verdict.code).toBe("POSSIBLE_MATCH_NEEDS_IDENTIFIER");
    expect(verdict.missingIdentifiers).not.toHaveLength(0);
  });

  it("maps infrastructure errors only to retryable failure", () => {
    const verdict = verifyNotice({
      authoritativeRecallFound: true,
      exactRecallIdMatch: true,
      exactProductMatch: true,
      matchCriticalIdentifierPresent: true,
      noticeChannelMatchesVerifiedChannel: true,
      verifiedContactAvailable: true,
      unsafeSensitiveRequest: false,
      externalFailure: true,
      facts: [],
    });
    expect(verdict.code).toBe("VERIFICATION_FAILED_RETRYABLE");
  });
});
