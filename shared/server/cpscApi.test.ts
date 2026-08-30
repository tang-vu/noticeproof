import { describe, expect, it, vi } from "vitest";
import { lookupCpscRecall } from "./cpscApi";

describe("CPSC structured control lookup", () => {
  it("accepts only an exact recall number and allowlisted recall URLs", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              RecallNumber: "25-459",
              RecallURL: "http://www.cpsc.gov/Recalls/2025/example?utm_source=feed",
            },
            { RecallNumber: "25-459", URL: "https://evil.example/recall" },
            { RecallNumber: "25-111", RecallURL: "https://cpsc.gov/Recalls/wrong" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    ) as unknown as typeof fetch;
    await expect(lookupCpscRecall("25-459", fetcher)).resolves.toEqual({
      exactRecordFound: true,
      recallUrls: ["https://www.cpsc.gov/Recalls/2025/example"],
    });
  });

  it("does not call the service for malformed identifiers", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(lookupCpscRecall("click here", fetcher)).resolves.toEqual({
      exactRecordFound: false,
      recallUrls: [],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed external payloads instead of partially trusting them", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ RecallNumber: "25-459" }), { status: 200 })),
    ) as unknown as typeof fetch;
    await expect(lookupCpscRecall("25-459", fetcher)).rejects.toThrow();
  });
});
