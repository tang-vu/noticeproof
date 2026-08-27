import { describe, expect, it } from "vitest";
import {
  hasSensitiveRequest,
  redactSensitiveText,
  sanitizePlainText,
} from "../shared/domain/redaction";

describe("untrusted text controls", () => {
  it("removes executable markup and control characters", () => {
    expect(sanitizePlainText("<script>alert(1)</script><b>Hello</b>\u0000 world")).toBe(
      "Hello world",
    );
  });

  it("redacts contact and secret material", () => {
    const redacted = redactSensitiveText(
      "Email person@example.com or 212-555-0199. Password: hunter2",
    );
    expect(redacted).not.toContain("person@example.com");
    expect(redacted).not.toContain("hunter2");
  });

  it.each(["send your one-time code", "pay with a gift card", "log in now", "enter bank details"])(
    "detects sensitive request: %s",
    (value) => expect(hasSensitiveRequest(value)).toBe(true),
  );
});
