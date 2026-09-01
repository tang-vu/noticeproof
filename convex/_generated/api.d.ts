/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as approvals from "../approvals.js";
import type * as cases from "../cases.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as evidencePipeline from "../evidencePipeline.js";
import type * as explanationPersistence from "../explanationPersistence.js";
import type * as extraction from "../extraction.js";
import type * as firecrawl from "../firecrawl.js";
import type * as http from "../http.js";
import type * as integrationProofs from "../integrationProofs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_outboundPayload from "../lib/outboundPayload.js";
import type * as lib_receipts from "../lib/receipts.js";
import type * as lib_retention from "../lib/retention.js";
import type * as maintenance from "../maintenance.js";
import type * as model_validators from "../model/validators.js";
import type * as openaiExplanation from "../openaiExplanation.js";
import type * as openaiExtraction from "../openaiExtraction.js";
import type * as openaiPersistence from "../openaiPersistence.js";
import type * as seeds from "../seeds.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  approvals: typeof approvals;
  cases: typeof cases;
  crons: typeof crons;
  email: typeof email;
  evidencePipeline: typeof evidencePipeline;
  explanationPersistence: typeof explanationPersistence;
  extraction: typeof extraction;
  firecrawl: typeof firecrawl;
  http: typeof http;
  integrationProofs: typeof integrationProofs;
  "lib/access": typeof lib_access;
  "lib/outboundPayload": typeof lib_outboundPayload;
  "lib/receipts": typeof lib_receipts;
  "lib/retention": typeof lib_retention;
  maintenance: typeof maintenance;
  "model/validators": typeof model_validators;
  openaiExplanation: typeof openaiExplanation;
  openaiExtraction: typeof openaiExtraction;
  openaiPersistence: typeof openaiPersistence;
  seeds: typeof seeds;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
