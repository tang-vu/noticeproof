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

  it("deterministically repairs a unique exact quote instead of trusting model offsets", async () => {
    const parser: ResponsesParser = {
      parse: () =>
        Promise.resolve({
          id: "span-repair",
          output_parsed: {
            ...validEnvelope,
            productName: {
              value: "Shape Sorter Car",
              confidence: 0.9,
              span: { start: 99, end: 120, quote: "Shape Sorter Car" },
            },
          },
        }),
    };
    const result = await extractClaimEnvelope({
      noticeText: "Recall: Shape Sorter Car model MZL-038.",
      parser,
    });
    expect(result.envelope.productName?.span).toEqual({
      start: 8,
      end: 24,
      quote: "Shape Sorter Car",
    });
  });

  it("rejects hallucinated or ambiguous source quotes after bounded retries", async () => {
    let calls = 0;
    const parser: ResponsesParser = {
      parse: () => {
        calls += 1;
        return Promise.resolve({
          id: `bad-span-${calls}`,
          output_parsed: {
            ...validEnvelope,
            productName: {
              value: "Imagined Product",
              confidence: 0.9,
              span: { start: 0, end: 16, quote: "Imagined Product" },
            },
          },
        });
      },
    };
    await expect(
      extractClaimEnvelope({ noticeText: "No product is named here.", parser }),
    ).rejects.toBeInstanceOf(ClaimExtractionError);
    expect(calls).toBe(2);
  });

  it("accepts the explicit zero-length span convention for image-only text", async () => {
    const parser: ResponsesParser = {
      parse: () =>
        Promise.resolve({
          id: "image-span",
          output_parsed: {
            ...validEnvelope,
            recallId: {
              value: "25-237",
              confidence: 0.95,
              span: { start: 0, end: 0, quote: "25-237" },
            },
          },
        }),
    };
    const result = await extractClaimEnvelope({
      noticeText: "[Screenshot submitted for claim extraction.]",
      imageDataUrl: "https://files.example.test/private-signed-image",
      parser,
    });
    expect(result.envelope.recallId?.span).toEqual({ start: 0, end: 0, quote: "25-237" });
  });
});
