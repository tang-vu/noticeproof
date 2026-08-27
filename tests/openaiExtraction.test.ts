import { describe, expect, it } from "vitest";
import { CLAIM_SCHEMA_VERSION } from "../shared/domain/constants";
import {
  ClaimExtractionError,
  extractClaimEnvelope,
  type ResponsesParser,
} from "../shared/server/openaiExtraction";

const validEnvelope = {
  schemaVersion: CLAIM_SCHEMA_VERSION,
  language: "en",
  noticeType: "recall",
  claimedSender: null,
  parsedSender: null,
  retailer: null,
  manufacturer: null,
  productName: null,
  category: null,
  recallId: null,
  models: [],
  serials: [],
  lots: [],
  upcs: [],
  orderNumbers: [],
  purchaseDates: [],
  affectedDateRanges: [],
  hazard: null,
  urgency: null,
  remedy: { type: "unknown", detail: null },
  urls: [],
  emails: [],
  phones: [],
  physicalDestinations: [],
  requestedSensitiveData: [],
} as const;

describe("OpenAI structured extraction boundary", () => {
  it("retries one invalid output and accepts only a validated envelope", async () => {
    let calls = 0;
    const parser: ResponsesParser = {
      parse: () => {
        calls += 1;
        return Promise.resolve({
          id: `resp_${calls}`,
          output_parsed: calls === 1 ? { partial: true } : validEnvelope,
        });
      },
    };
    const result = await extractClaimEnvelope({ noticeText: "untrusted", parser });
    expect(result.attempts).toBe(2);
    expect(result.responseId).toBe("resp_2");
    expect(result.envelope.schemaVersion).toBe(CLAIM_SCHEMA_VERSION);
  });

  it("fails safely after the bounded retry budget", async () => {
    const parser: ResponsesParser = {
      parse: () => Promise.resolve({ id: "bad", output_parsed: { partial: true } }),
    };
    await expect(extractClaimEnvelope({ noticeText: "untrusted", parser })).rejects.toBeInstanceOf(
      ClaimExtractionError,
    );
  });

  it("does not accept more than two attempts", async () => {
    let calls = 0;
    const parser: ResponsesParser = {
      parse: () => {
        calls += 1;
        return Promise.reject(new Error("temporary"));
      },
    };
    await expect(
      extractClaimEnvelope({ noticeText: "untrusted", parser, maxAttempts: 99 }),
    ).rejects.toBeInstanceOf(ClaimExtractionError);
    expect(calls).toBe(2);
  });
});
