import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { SpecScoreService } from "./SpecScoreService";
import type { SpecScoreResult, SpecScorer } from "./SpecScorer";
import type { DerivedSpec, RawProduct } from "../types";

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "test",
  requirements: [{ key: "ram", value: "16GB", importance: "required" }],
  searchQueries: ["mini pc"],
  excludedTerms: [],
};

const PRODUCTS: RawProduct[] = [
  {
    id: "p1",
    marketplace: "ricardo",
    title: "Mini PC",
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: "https://x",
    location: null,
    raw: {},
  },
];

function mapOf(entries: [string, number][]): Map<string, SpecScoreResult> {
  return new Map(
    entries.map(([id, specScore]) => [id, { specScore, matchedRequirements: [], reasons: [] }]),
  );
}

interface FakeScorer extends SpecScorer {
  score: Mock<(products: RawProduct[], spec: DerivedSpec) => Promise<Map<string, SpecScoreResult>>>;
}

function fakeScorer(result: Map<string, SpecScoreResult> | Error): FakeScorer {
  return {
    score:
      result instanceof Error
        ? vi.fn(async () => {
            throw result;
          })
        : vi.fn(async () => result),
  };
}

describe("SpecScoreService", () => {
  it("returns primary result as-is when full", async () => {
    const primary = mapOf([["p1", 87]]);
    const svc = new SpecScoreService(fakeScorer(primary), fakeScorer(mapOf([["p1", 10]])));
    await expect(svc.score(PRODUCTS, SPEC)).resolves.toBe(primary);
  });

  it("returns fallback result when primary throws", async () => {
    const fallback = mapOf([["p1", 42]]);
    const svc = new SpecScoreService(fakeScorer(new Error("boom")), fakeScorer(fallback));
    await expect(svc.score(PRODUCTS, SPEC)).resolves.toBe(fallback);
  });

  it("returns fallback result on partial primary map", async () => {
    const fallback = mapOf([["p1", 42]]);
    const svc = new SpecScoreService(fakeScorer(new Map()), fakeScorer(fallback));
    await expect(svc.score(PRODUCTS, SPEC)).resolves.toBe(fallback);
  });

  it("returns empty map for empty input without calling scorers", async () => {
    const primary = fakeScorer(mapOf([["p1", 87]]));
    const fallback = fakeScorer(mapOf([["p1", 42]]));
    const svc = new SpecScoreService(primary, fallback);
    await expect(svc.score([], SPEC)).resolves.toEqual(new Map());
    expect(primary.score).not.toHaveBeenCalled();
    expect(fallback.score).not.toHaveBeenCalled();
  });
});
