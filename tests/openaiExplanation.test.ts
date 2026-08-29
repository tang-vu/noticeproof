import { describe, expect, it } from "vitest";
import { generateBoundedExplanation } from "../shared/server/openaiExplanation";

describe("bounded OpenAI verdict explanation", () => {
  it("renders only allowlisted TypeScript templates", async () => {
    const result = await generateBoundedExplanation({
      verdictCode: "VERIFIED_RECALL_UNSAFE_CHANNEL",
      ruleResults: [
        { ruleId: "NP-AUTH-001", outcome: "pass" },
        { ruleId: "NP-CHANNEL-002", outcome: "fail" },
      ],
      model: "test-model",
      parser: {
        parse: () =>
          Promise.resolve({
            id: "response_test",
            output_parsed: {
              templateIds: ["OFFICIAL_RECALL_FOUND", "NOTICE_CHANNEL_UNVERIFIED"],
              referencedRuleIds: ["NP-AUTH-001", "NP-CHANNEL-002"],
            },
          }),
      },
    });
    expect(result.text).toContain("authoritative CPSC record");
    expect(result.text).toContain("blocks it");
    expect(result.text).not.toContain("response_test");
  });

  it("rejects a valid template that is not allowed for the verdict", async () => {
    await expect(
      generateBoundedExplanation({
        verdictCode: "NO_AUTHORITATIVE_EVIDENCE",
        ruleResults: [{ ruleId: "NP-AUTH-001", outcome: "unresolved" }],
        model: "test-model",
        parser: {
          parse: () =>
            Promise.resolve({
              id: "response_test",
              output_parsed: {
                templateIds: ["OFFICIAL_RECALL_FOUND"],
                referencedRuleIds: ["NP-AUTH-001"],
              },
            }),
        },
      }),
    ).rejects.toThrow("EXPLANATION_TEMPLATE_NOT_ALLOWED");
  });

  it("rejects invented rule references", async () => {
    await expect(
      generateBoundedExplanation({
        verdictCode: "NO_AUTHORITATIVE_EVIDENCE",
        ruleResults: [{ ruleId: "NP-AUTH-001", outcome: "unresolved" }],
        model: "test-model",
        parser: {
          parse: () =>
            Promise.resolve({
              id: "response_test",
              output_parsed: {
                templateIds: ["NO_AUTHORITY_EVIDENCE"],
                referencedRuleIds: ["NP-INVENTED-999"],
              },
            }),
        },
      }),
    ).rejects.toThrow("EXPLANATION_RULE_NOT_ALLOWED");
  });
});
