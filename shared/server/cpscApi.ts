import { z } from "zod";
import { parseSafePublicUrl } from "../domain/urlSafety";

const CPSC_API_URL = "https://www.saferproducts.gov/RestWebServices/Recall";
const CpscRecord = z
  .object({
    RecallNumber: z.string().optional(),
    RecallURL: z.string().optional(),
    URL: z.string().optional(),
  })
  .passthrough();
const CpscResponse = z.array(CpscRecord).max(100);

export type CpscLookup = {
  exactRecordFound: boolean;
  recallUrls: string[];
};

/**
 * Best-effort structured CPSC control lookup. The API narrows discovery only;
 * the verifier still requires independently fetched evidence before a verdict.
 */
export async function lookupCpscRecall(
  recallId: string,
  fetcher: typeof fetch = fetch,
): Promise<CpscLookup> {
  const normalizedRecallId = recallId.trim().toUpperCase();
  if (!/^\d{2,4}-\d{2,6}$/.test(normalizedRecallId)) {
    return { exactRecordFound: false, recallUrls: [] };
  }
  const url = new URL(CPSC_API_URL);
  url.searchParams.set("RecallNumber", normalizedRecallId);
  url.searchParams.set("format", "json");
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`CPSC_API_${response.status}`);
  const records = CpscResponse.parse(await response.json());
  const exact = records.filter(
    (record) => record.RecallNumber?.trim().toUpperCase() === normalizedRecallId,
  );
  const recallUrls = [
    ...new Set(
      exact
        .flatMap((record) => [record.RecallURL, record.URL])
        .flatMap((raw) => {
          if (!raw) return [];
          try {
            const safe = parseSafePublicUrl(raw);
            const url = new URL(safe.canonicalUrl);
            if (
              !["cpsc.gov", "www.cpsc.gov"].includes(safe.hostname) ||
              !url.pathname.toLowerCase().startsWith("/recalls/")
            ) {
              return [];
            }
            url.protocol = "https:";
            return [url.toString()];
          } catch {
            return [];
          }
        }),
    ),
  ];
  return { exactRecordFound: exact.length > 0, recallUrls };
}
