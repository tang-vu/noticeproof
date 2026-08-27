import { describe, expect, it } from "vitest";
import { canonicalJson, hashCanonical } from "../shared/domain/hashing";

describe("evidence hashing", () => {
  it("is deterministic across object key order", async () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    await expect(hashCanonical({ b: 2, a: 1 })).resolves.toBe(await hashCanonical({ a: 1, b: 2 }));
  });

  it("preserves array order", async () => {
    expect(await hashCanonical([1, 2])).not.toBe(await hashCanonical([2, 1]));
  });
});
