import { describe, expect, it } from "vitest";
import { selectAuthorityLinkedManufacturerUrl } from "./manufacturerEvidence";

describe("authority-linked manufacturer evidence", () => {
  it("prefers a name-correlated recall page and canonicalizes tracking", () => {
    expect(
      selectAuthorityLinkedManufacturerUrl(
        [
          "https://facebook.com/epoca",
          "https://epoca.com/minifridgerecall/?utm_source=cpsc#details",
          "https://unrelated.example/about",
        ],
        "Epoca International",
      ),
    ).toBe("https://epoca.com/minifridgerecall/");
  });

  it("rejects unsafe, social, punycode, and unrelated links", () => {
    expect(
      selectAuthorityLinkedManufacturerUrl(
        [
          "http://epoca.com/recall",
          "https://facebook.com/recall",
          "https://xn--poca-9oa.example/recall",
          "https://unrelated.example/about",
          "http://127.0.0.1/recall",
        ],
        "Epoca International",
      ),
    ).toBeUndefined();
  });
});
