import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export const explanationTemplateIdSchema = z.enum([
  "OFFICIAL_RECALL_FOUND",
  "EXACT_SCOPE_MATCHED",
  "OFFICIAL_CHANNEL_VERIFIED",
  "NOTICE_CHANNEL_UNVERIFIED",
  "VERIFIED_CHANNEL_SWITCH",
  "SENSITIVE_REQUEST_BLOCKED",
  "REMEDY_CONFLICT_BLOCKED",
  "IDENTIFIER_REQUIRED",
  "NO_AUTHORITY_EVIDENCE",
  "RETRYABLE_SYSTEM_FAILURE",
  "HUMAN_APPROVAL_REQUIRED",
]);

const explanationSelectionSchema = z.object({
  templateIds: z.array(explanationTemplateIdSchema).min(1).max(4),
  referencedRuleIds: z.array(z.string().min(1).max(80)).max(8),
});

type TemplateId = z.infer<typeof explanationTemplateIdSchema>;
type ParsedResponse = { id: string; output_parsed: unknown };
export type ExplanationParser = { parse: (request: unknown) => Promise<ParsedResponse> };

const TEMPLATE_TEXT: Record<TemplateId, string> = {
  OFFICIAL_RECALL_FOUND: "An authoritative CPSC record establishes that the recall itself is real.",
  EXACT_SCOPE_MATCHED:
    "The notice's exact recall or product identifiers align with the affected scope in that record.",
  OFFICIAL_CHANNEL_VERIFIED:
    "The contact channel in the notice is independently listed by authoritative evidence.",
  NOTICE_CHANNEL_UNVERIFIED:
    "The notice's destination is not established by the authoritative evidence, so NoticeProof blocks it.",
  VERIFIED_CHANNEL_SWITCH:
    "Use the independently recovered verified contact instead of replying to or clicking the notice.",
  SENSITIVE_REQUEST_BLOCKED:
    "A request for sensitive information through an unverified destination creates a blocking conflict.",
  REMEDY_CONFLICT_BLOCKED:
    "The remedy claimed by the notice conflicts with the instructions in the authoritative recall record.",
  IDENTIFIER_REQUIRED:
    "An exact model, lot, serial, UPC, or date identifier is still needed before product scope can be decided.",
  NO_AUTHORITY_EVIDENCE:
    "No matching authoritative record was found; that absence does not prove the notice false or the product safe.",
  RETRYABLE_SYSTEM_FAILURE:
    "Verification could not complete because a system dependency failed, so no safety conclusion was produced.",
  HUMAN_APPROVAL_REQUIRED:
    "Any eligible email remains blocked until you review and approve the exact verified recipient and payload.",
};

const TEMPLATES_BY_VERDICT: Record<string, TemplateId[]> = {
  VERIFIED_OFFICIAL_CHANNEL: [
    "OFFICIAL_RECALL_FOUND",
    "EXACT_SCOPE_MATCHED",
    "OFFICIAL_CHANNEL_VERIFIED",
    "HUMAN_APPROVAL_REQUIRED",
  ],
  VERIFIED_RECALL_UNSAFE_CHANNEL: [
    "OFFICIAL_RECALL_FOUND",
    "EXACT_SCOPE_MATCHED",
    "NOTICE_CHANNEL_UNVERIFIED",
    "VERIFIED_CHANNEL_SWITCH",
    "HUMAN_APPROVAL_REQUIRED",
  ],
  POSSIBLE_MATCH_NEEDS_IDENTIFIER: ["OFFICIAL_RECALL_FOUND", "IDENTIFIER_REQUIRED"],
  CONFLICTING_NOTICE: [],
  NO_AUTHORITATIVE_EVIDENCE: ["NO_AUTHORITY_EVIDENCE"],
  VERIFICATION_FAILED_RETRYABLE: ["RETRYABLE_SYSTEM_FAILURE"],
};

function allowedTemplatesFor(verdictCode: string, ruleIds: Set<string>): TemplateId[] {
  if (verdictCode !== "CONFLICTING_NOTICE") return TEMPLATES_BY_VERDICT[verdictCode] ?? [];
  return [
    ...(ruleIds.has("NP-SAFE-001") ? (["SENSITIVE_REQUEST_BLOCKED"] as const) : []),
    ...(ruleIds.has("NP-REMEDY-001") ? (["REMEDY_CONFLICT_BLOCKED"] as const) : []),
    ...(ruleIds.has("NP-CHANNEL-002") ? (["NOTICE_CHANNEL_UNVERIFIED"] as const) : []),
  ];
}

export async function generateBoundedExplanation(args: {
  verdictCode: string;
  ruleResults: Array<{ ruleId: string; outcome: string }>;
  apiKey?: string;
  model: string;
  parser?: ExplanationParser;
}) {
  const allowedRuleIds = new Set(args.ruleResults.map((rule) => rule.ruleId));
  const allowedTemplates = allowedTemplatesFor(args.verdictCode, allowedRuleIds);
  if (!allowedTemplates?.length) throw new Error("EXPLANATION_VERDICT_UNSUPPORTED");
  const client = args.parser ?? createParser(args.apiKey);
  const response = await client.parse({
    model: args.model,
    store: false,
    input: [
      {
        role: "system",
        content:
          "Select the clearest ordered explanation templates for a consumer. You may only select supplied template IDs and rule IDs. Do not add facts, prose, URLs, contacts, verdicts, or recommendations.",
      },
      {
        role: "user",
        content: JSON.stringify({
          verdictCode: args.verdictCode,
          allowedTemplates,
          ruleResults: args.ruleResults,
        }),
      },
    ],
    text: {
      format: zodTextFormat(explanationSelectionSchema, "noticeproof_explanation_selection", {
        description: "A bounded selection of existing explanation templates and rule IDs.",
      }),
    },
  });
  const selection = explanationSelectionSchema.parse(response.output_parsed);
  if (selection.templateIds.some((templateId) => !allowedTemplates.includes(templateId))) {
    throw new Error("EXPLANATION_TEMPLATE_NOT_ALLOWED");
  }
  if (selection.referencedRuleIds.some((ruleId) => !allowedRuleIds.has(ruleId))) {
    throw new Error("EXPLANATION_RULE_NOT_ALLOWED");
  }
  return {
    responseId: response.id,
    templateIds: selection.templateIds,
    referencedRuleIds: selection.referencedRuleIds,
    text: selection.templateIds.map((templateId) => TEMPLATE_TEXT[templateId]).join(" "),
  };
}

function createParser(apiKey?: string): ExplanationParser {
  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  return {
    parse: (request) =>
      client.responses.parse(request as Parameters<typeof client.responses.parse>[0]),
  };
}
