import { parseSafePublicUrl } from "./urlSafety";

const EXCLUDED_DOMAINS = new Set([
  "cpsc.gov",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !["company", "international", "products"].includes(word));
}

/**
 * Selects a conservative same-page authority link for a manufacturer crawl.
 * A link must be HTTPS, non-punycode, non-social, and either name-correlated or
 * clearly point at a recall/support/safety path. Search rank is never consulted.
 */
export function selectAuthorityLinkedManufacturerUrl(
  links: readonly string[],
  manufacturer?: string,
): string | undefined {
  const manufacturerWords = words(manufacturer ?? "");
  const candidates = links.flatMap((raw) => {
    try {
      const safe = parseSafePublicUrl(raw);
      if (
        !safe.canonicalUrl.startsWith("https://") ||
        safe.isPunycode ||
        EXCLUDED_DOMAINS.has(safe.registrableDomain)
      ) {
        return [];
      }
      const url = new URL(safe.canonicalUrl);
      const domainText = safe.registrableDomain.replace(/[^a-z0-9]/g, "");
      const nameMatch = manufacturerWords.some((word) => domainText.includes(word));
      const recallPath = /\b(recall|safety|support|remedy)\b/i.test(
        decodeURIComponent(url.pathname).replace(/[^a-z0-9]+/gi, " "),
      );
      if (!nameMatch && !recallPath) return [];
      return [{ url: safe.canonicalUrl, score: Number(nameMatch) * 3 + Number(recallPath) * 2 }];
    } catch {
      return [];
    }
  });
  return candidates.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))[0]?.url;
}
