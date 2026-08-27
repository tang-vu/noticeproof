import { getDomain } from "tldts";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const bytes = parts.map(Number);
  if (bytes.some((byte) => byte > 255)) return true;
  const [a = 0, b = 0] = bytes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

export type SafeUrl = {
  canonicalUrl: string;
  hostname: string;
  registrableDomain: string;
  isPunycode: boolean;
};

export function parseSafePublicUrl(raw: string): SafeUrl {
  const parsed = new URL(raw.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password)
    throw new Error("Credential-bearing URLs are not allowed");
  const ascii = parsed.hostname.toLowerCase();
  if (
    !ascii ||
    BLOCKED_HOSTS.has(ascii) ||
    ascii.endsWith(".localhost") ||
    ascii.endsWith(".local")
  ) {
    throw new Error("Local URLs are not allowed");
  }
  if (isPrivateIpv4(ascii) || isPrivateIpv6(ascii))
    throw new Error("Private-network URLs are not allowed");
  const registrableDomain = getDomain(ascii, { allowPrivateDomains: false });
  if (!registrableDomain) throw new Error("URL must have a public registrable domain");
  parsed.hostname = ascii;
  parsed.hash = "";
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  )
    parsed.port = "";
  [...parsed.searchParams.keys()]
    .filter((key) => /^utm_|^(fbclid|gclid)$/i.test(key))
    .forEach((key) => parsed.searchParams.delete(key));
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
  return {
    canonicalUrl: parsed.toString(),
    hostname: ascii,
    registrableDomain,
    isPunycode: ascii.includes("xn--"),
  };
}

export function sameRegistrableDomain(a: string, b: string): boolean {
  return parseSafePublicUrl(a).registrableDomain === parseSafePublicUrl(b).registrableDomain;
}
