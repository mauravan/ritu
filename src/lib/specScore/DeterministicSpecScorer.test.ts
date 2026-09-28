import { describe, expect, it, vi } from "vitest";
import { DeterministicSpecScorer } from "./DeterministicSpecScorer";
import type { DerivedSpec, RawProduct } from "../types";

function makeProduct(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: "1",
    marketplace: "ricardo",
    title: "Test Product",
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: "https://example.com/1",
    location: null,
    raw: {},
    ...overrides,
  };
}

const baseSpec: DerivedSpec = {
  category: "laptop",
  summary: "test",
  requirements: [
    { key: "cpu", value: "i7", importance: "required" },
    { key: "ram", value: "16gb", importance: "required" },
  ],
  searchQueries: ["laptop i7 16gb"],
  excludedTerms: [],
};

describe("DeterministicSpecScorer", () => {
  it("returns empty map for empty input", async () => {
    const scorer = new DeterministicSpecScorer();
    await expect(scorer.score([], baseSpec)).resolves.toEqual(new Map());
  });

  it("sinks excluded-term products below normal ones", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = { ...baseSpec, excludedTerms: ["sleeve"] };
    const result = await scorer.score(
      [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 500 }),
        makeProduct({ id: "2", title: "i7 16gb laptop sleeve", priceChf: 500 }),
      ],
      spec,
    );
    expect(result.get("2")?.specScore).toBeLessThan(result.get("1")?.specScore ?? 0);
  });

  it("emits excluded-term penalty reason", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = { ...baseSpec, excludedTerms: ["sleeve"] };
    const result = await scorer.score(
      [makeProduct({ id: "1", title: "i7 16gb laptop sleeve", priceChf: 500 })],
      spec,
    );
    expect(result.get("1")?.reasons).toContain('Penalty: excluded term "sleeve"');
  });

  it("emits numeric mismatch reason with the field", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = {
      ...baseSpec,
      requirements: [{ key: "ram", value: "32gb", importance: "required" }],
    };
    const result = await scorer.score(
      [makeProduct({ id: "1", title: "laptop", priceChf: 500 })],
      spec,
    );
    expect(result.get("1")?.reasons).toContain("Penalty: numeric mismatch (ram: 32gb)");
  });

  it("matches requirements from raw text", async () => {
    const scorer = new DeterministicSpecScorer();
    const result = await scorer.score(
      [makeProduct({ id: "1", title: "laptop", priceChf: 800, raw: "i7 16gb rtx 3080 specs" })],
      baseSpec,
    );
    expect(result.get("1")?.matchedRequirements).toContain("cpu: i7");
  });

  it("applies GPU compare bonus/penalty", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = {
      ...baseSpec,
      requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
    };
    const result = await scorer.score(
      [
        makeProduct({ id: "1", title: "laptop rtx 3080", priceChf: 1500 }),
        makeProduct({ id: "2", title: "laptop rtx 3060", priceChf: 1000 }),
        makeProduct({ id: "3", title: "laptop gtx 1650", priceChf: 800 }),
      ],
      spec,
    );
    const better = result.get("1")?.specScore ?? 0;
    const worse = result.get("3")?.specScore ?? 0;
    expect(better).toBeGreaterThan(worse);
  });

  it("handles GPU signal raw string, null raw, and missing GPU", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = {
      ...baseSpec,
      requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
    };
    const result = await scorer.score(
      [
        makeProduct({ id: "1", title: "laptop", raw: "has rtx 3060 inside", priceChf: 1000 }),
        makeProduct({ id: "2", title: "plain laptop", raw: {}, priceChf: 800 }),
        makeProduct({ id: "3", title: "laptop rtx 3080", raw: null, priceChf: 1200 }),
      ],
      spec,
    );
    expect(result.size).toBe(3);
  });

  it("handles preferred importance in title and raw", async () => {
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = {
      ...baseSpec,
      requirements: [{ key: "ram", value: "32gb", importance: "preferred" }],
    };
    const result = await scorer.score(
      [
        makeProduct({ id: "1", title: "laptop 32gb", priceChf: 800 }),
        makeProduct({ id: "2", title: "laptop", raw: "has 32gb memory", priceChf: 700 }),
      ],
      spec,
    );
    expect(result.size).toBe(2);
    expect(result.get("1")?.matchedRequirements).toContain("ram: 32gb");
    expect(result.get("2")?.matchedRequirements).toContain("ram: 32gb");
  });

  it("scales batch scores to [1,100]", async () => {
    const scorer = new DeterministicSpecScorer();
    const result = await scorer.score(
      [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "unrelated toaster", priceChf: 100 }),
      ],
      baseSpec,
    );
    for (const r of result.values()) {
      expect(r.specScore).toBeGreaterThanOrEqual(1);
      expect(r.specScore).toBeLessThanOrEqual(100);
    }
    const vals = [...result.values()].map((r) => r.specScore);
    expect(Math.max(...vals)).toBe(100);
  });

  it("handles invalid RANKING_SIGNAL_WEIGHTS gracefully", async () => {
    vi.stubEnv("RANKING_SIGNAL_WEIGHTS", "invalid json");
    const scorer = new DeterministicSpecScorer();
    const result = await scorer.score(
      [makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 })],
      baseSpec,
    );
    expect(result.size).toBe(1);
    vi.unstubAllEnvs();
  });

  it("honors custom gpu weight from env", async () => {
    vi.stubEnv("RANKING_SIGNAL_WEIGHTS", '{"gpu": 2.0}');
    const scorer = new DeterministicSpecScorer();
    const spec: DerivedSpec = {
      ...baseSpec,
      requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
    };
    const result = await scorer.score(
      [makeProduct({ id: "1", title: "laptop rtx 3060", priceChf: 1000 })],
      spec,
    );
    expect(result.size).toBe(1);
    vi.unstubAllEnvs();
  });
});
