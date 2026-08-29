import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type ReadCtx = QueryCtx | MutationCtx;

const encoder = new TextEncoder();

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashCapabilityToken(value: string): Promise<string> {
  return await sha256(
    env.CAPABILITY_HASH_PEPPER ? `${env.CAPABILITY_HASH_PEPPER}:${value}` : value,
  );
}

export async function requireCaseAccess(
  ctx: ReadCtx,
  publicId: string,
  capabilityToken?: string,
): Promise<Doc<"cases">> {
  const caseDocument = await ctx.db
    .query("cases")
    .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
    .unique();

  if (!caseDocument) throw new Error("CASE_NOT_FOUND");
  if (caseDocument.isPublicFixture) return caseDocument;
  if (caseDocument.accessRevokedAt) throw new Error("CASE_EXPIRED");
  if (!capabilityToken) throw new Error("CASE_ACCESS_DENIED");

  const candidate = await hashCapabilityToken(capabilityToken);
  if (candidate !== caseDocument.capabilityHash) throw new Error("CASE_ACCESS_DENIED");
  return caseDocument;
}

export async function requireCaseWriteAccess(
  ctx: ReadCtx,
  publicId: string,
  capabilityToken?: string,
): Promise<Doc<"cases">> {
  const caseDocument = await requireCaseAccess(ctx, publicId, capabilityToken);
  if (caseDocument.isPublicFixture) throw new Error("PUBLIC_FIXTURE_READ_ONLY");
  return caseDocument;
}

export function createCapabilityToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
