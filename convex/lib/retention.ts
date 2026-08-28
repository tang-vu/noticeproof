import { env } from "../_generated/server";

export function rawRetentionUntil(now: number): number {
  const configured = Number.parseInt(env.RAW_RETENTION_DAYS ?? "7", 10);
  const days = Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 30) : 7;
  return now + days * 24 * 60 * 60 * 1000;
}
