import { z } from "zod";
import { CLAIM_SCHEMA_VERSION, REMEDY_TYPES } from "./constants";

const sourceSpan = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  quote: z.string().max(500),
});

const extractedString = z.object({
  value: z.string().max(500),
  confidence: z.number().min(0).max(1),
  span: sourceSpan,
});

export const claimEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(CLAIM_SCHEMA_VERSION),
    language: z.string().min(2).max(20),
    noticeType: z.enum(["recall", "safety_warning", "unknown"]),
    claimedSender: extractedString.nullable(),
    parsedSender: z
      .object({
        name: z.string().max(200).nullable(),
        email: z.string().email().max(320).nullable(),
      })
      .nullable(),
    retailer: extractedString.nullable(),
    manufacturer: extractedString.nullable(),
    productName: extractedString.nullable(),
    category: extractedString.nullable(),
    recallId: extractedString.nullable(),
    models: z.array(extractedString).max(30),
    serials: z.array(extractedString).max(30),
    lots: z.array(extractedString).max(30),
    upcs: z.array(extractedString).max(30),
    orderNumbers: z.array(extractedString).max(10),
    purchaseDates: z.array(extractedString).max(10),
    affectedDateRanges: z.array(extractedString).max(10),
    hazard: extractedString.nullable(),
    urgency: extractedString.nullable(),
    remedy: z.object({ type: z.enum(REMEDY_TYPES), detail: extractedString.nullable() }),
    urls: z.array(extractedString).max(30),
    emails: z.array(extractedString).max(30),
    phones: z.array(extractedString).max(20),
    physicalDestinations: z.array(extractedString).max(10),
    requestedSensitiveData: z
      .array(
        z.object({
          kind: z.enum([
            "password",
            "one_time_code",
            "payment_data",
            "gift_card",
            "bank_details",
            "credentials",
            "download",
            "login",
            "other",
          ]),
          span: sourceSpan,
        }),
      )
      .max(20),
  })
  .strict();

export type ClaimEnvelope = z.infer<typeof claimEnvelopeSchema>;
