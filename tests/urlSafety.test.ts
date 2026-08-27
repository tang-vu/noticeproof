import { describe, expect, it } from "vitest";
import { parseSafePublicUrl, sameRegistrableDomain } from "../shared/domain/urlSafety";

describe("URL safety", () => {
  it("canonicalizes URLs and strips trackers/fragments", () => {
    expect(
      parseSafePublicUrl("HTTPS://WWW.CPSC.GOV:443//Recalls/?utm_source=x&id=2#top"),
    ).toMatchObject({
      canonicalUrl: "https://www.cpsc.gov/Recalls/?id=2",
      hostname: "www.cpsc.gov",
      registrableDomain: "cpsc.gov",
    });
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "http://localhost/admin",
    "http://127.0.0.1/admin",
    "http://10.2.3.4/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "https://user:pass@example.com/",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => parseSafePublicUrl(url)).toThrow();
  });

  it("reveals subdomain traps by registrable domain", () => {
    expect(parseSafePublicUrl("https://cpsc.gov.evil.example/recall").registrableDomain).toBe(
      "evil.example",
    );
    expect(
      sameRegistrableDomain("https://recalls.example.com/a", "https://support.example.com/b"),
    ).toBe(true);
  });

  it("normalizes and marks internationalized domains", () => {
    const parsed = parseSafePublicUrl("https://аррӏе.com/recall");
    expect(parsed.hostname).toContain("xn--");
    expect(parsed.isPunycode).toBe(true);
  });
});
