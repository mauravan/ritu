import { describe, expect, it } from "vitest";
import { rankProductsUnified, tagExplanation } from "./ranking";
import type { SpecScoreResult } from "./specScore/SpecScorer";
import type { DerivedSpec, RawProduct, Tag } from "./types";

describe("ranking", () => {
  describe("tagExplanation", () => {
    it("returns correct explanation for each known tag", () => {
      expect(tagExplanation("best specs")).toBe("Highest specScore");
      expect(tagExplanation("best value")).toBe("Best valueScore (spec adjusted for price)");
      expect(tagExplanation("cheapest")).toBe("Lowest price among specScore≥40");
      expect(tagExplanation("best condition")).toBe("Best condition 'new/neu' among specScore≥50");
      expect(tagExplanation("balanced")).toBe("Best harmonic mean of spec & value among untagged");
      expect(tagExplanation("best overall")).toBe(
        "Highest unified hybrid score (AI + spec + value)",
      );
    });

    it("returns tag itself for unknown tags", () => {
      expect(tagExplanation("unknown" as Tag)).toBe("unknown");
    });
  });

  describe("rankProductsUnified", () => {
    const makeProduct = (overrides: Partial<RawProduct> = {}): RawProduct => ({
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
    });

    const baseSpec: DerivedSpec = {
      category: "laptop",
      summary: "test spec",
      requirements: [
        { key: "cpu", value: "i7", importance: "required" },
        { key: "ram", value: "16gb", importance: "required" },
      ],
      searchQueries: ["laptop i7 16gb"],
      excludedTerms: [],
    };

    function scores(entries: [string, Partial<SpecScoreResult>][]): Map<string, SpecScoreResult> {
      return new Map(
        entries.map(([id, r]) => [
          id,
          {
            specScore: r.specScore ?? 50,
            matchedRequirements: r.matchedRequirements ?? [],
            reasons: r.reasons ?? [],
          },
        ]),
      );
    }

    it("returns empty array for empty input", () => {
      expect(rankProductsUnified([], new Map())).toEqual([]);
    });

    it("ranks products and adds scores", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("specScore");
      expect(result[0]).toHaveProperty("hybridScore");
      expect(result[0]).toHaveProperty("tags");
    });

    it("sorts by hybridScore descending", () => {
      const products = [
        makeProduct({ id: "1", title: "laptop a", priceChf: 800 }),
        makeProduct({ id: "2", title: "laptop b", priceChf: 500 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result[0]?.hybridScore).toBeGreaterThanOrEqual(result[1]?.hybridScore ?? 0);
      // cheaper with equal spec sorts first via valueScore
      expect(result[0]?.id).toBe("2");
    });

    it("includes hybridScore and relevance", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result[0]).toHaveProperty("hybridScore");
      expect(result[0]).toHaveProperty("relevance");
    });

    it("handles products with missing price", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: null }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result).toHaveLength(2);
    });

    it("defaults missing specScore to 50", () => {
      const products = [makeProduct({ id: "1", title: "laptop", priceChf: 800 })];
      const result = rankProductsUnified(products, new Map());
      expect(result[0]?.specScore).toBe(50);
      expect(result[0]?.matchedRequirements).toEqual([]);
    });

    it("uses LLM scores when provided", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const rerankScores = new Map<string, { id: string; relevance: number }>();
      rerankScores.set("1", { id: "1", relevance: 95 });
      rerankScores.set("2", { id: "2", relevance: 30 });
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
        rerankScores,
      );
      expect(result[0]?.id).toBe("1");
      expect(result[0]?.relevance).toBe(95);
    });

    it("applies 0.6/0.4 weights without rerank and 0.35/0.25/0.4 with rerank", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 100 }),
        makeProduct({ id: "2", title: "b", priceChf: 200 }),
      ];
      const specMap = scores([
        ["1", { specScore: 80 }],
        ["2", { specScore: 60 }],
      ]);
      const noRerank = rankProductsUnified(products, specMap);
      // p1: spec 80, value 100 (max) → 0.6*80+0.4*100 = 88
      // p2: spec 60, value 1 (min) → 0.6*60+0.4*1 = 36.4 → 36
      expect(noRerank.find((p) => p.id === "1")?.hybridScore).toBe(88);
      expect(noRerank.find((p) => p.id === "2")?.hybridScore).toBe(36);

      const rerankScores = new Map([
        ["1", { id: "1", relevance: 50 }],
        ["2", { id: "2", relevance: 50 }],
      ]);
      const withRerank = rankProductsUnified(products, specMap, rerankScores);
      // p1: 0.35*80+0.25*100+0.4*50 = 73
      expect(withRerank.find((p) => p.id === "1")?.hybridScore).toBe(73);
    });

    it("assigns best condition tag for new products with specScore >= 50", () => {
      const products = [
        makeProduct({ id: "1", title: "laptop a", priceChf: 800, condition: "new" }),
        makeProduct({ id: "2", title: "laptop b", priceChf: 500, condition: "used" }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(true);
      const bestCond = result.find((p) => p.tags.includes("best condition"));
      expect(bestCond?.condition).toBe("new");
    });

    it("assigns balanced tag when >= 4 products", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 800 }),
        makeProduct({ id: "2", title: "b", priceChf: 500 }),
        makeProduct({ id: "3", title: "c", priceChf: 600 }),
        makeProduct({ id: "4", title: "d", priceChf: 700 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 90 }],
          ["2", { specScore: 80 }],
          ["3", { specScore: 70 }],
          ["4", { specScore: 60 }],
        ]),
      );
      expect(result.some((p) => p.tags.includes("balanced"))).toBe(true);
    });

    it("assigns best overall tag to highest hybridScore", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 800 }),
        makeProduct({ id: "2", title: "b", priceChf: 500 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result.some((p) => p.tags.includes("best overall"))).toBe(true);
      const bestOverall = result.find((p) => p.tags.includes("best overall"));
      expect(bestOverall?.id).toBe("2");
    });

    it("does not assign balanced tag when < 4 products", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 800 }),
        makeProduct({ id: "2", title: "b", priceChf: 500 }),
        makeProduct({ id: "3", title: "c", priceChf: 600 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 70 }],
          ["3", { specScore: 60 }],
        ]),
      );
      expect(result.some((p) => p.tags.includes("balanced"))).toBe(false);
    });

    it("does not assign best condition when no new products", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 800, condition: "used" }),
        makeProduct({ id: "2", title: "b", priceChf: 500, condition: "refurbished" }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(false);
    });

    it("does not assign best condition when specScore < 50", () => {
      const products = [makeProduct({ id: "1", title: "a", priceChf: 800, condition: "new" })];
      const result = rankProductsUnified(products, scores([["1", { specScore: 30 }]]));
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(false);
    });

    it("prefers a different product for best value when one product leads both", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 100 }),
        makeProduct({ id: "2", title: "b", priceChf: 500 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 90 }],
          ["2", { specScore: 40 }],
        ]),
      );
      const bestSpecs = result.find((p) => p.tags.includes("best specs"));
      const bestValue = result.find((p) => p.tags.includes("best value"));
      expect(bestSpecs?.id).toBe("1");
      // p1 also leads value, so second-best value product gets the tag
      expect(bestValue?.id).toBe("2");
    });

    it("assigns cheapest only among specScore >= 40", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 500 }),
        makeProduct({ id: "2", title: "b", priceChf: 100 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 30 }],
        ]),
      );
      const cheapest = result.find((p) => p.tags.includes("cheapest"));
      expect(cheapest?.id).toBe("1");
    });

    it("assigns single-product tag set", () => {
      const products = [makeProduct({ id: "1", title: "a", priceChf: 500 })];
      const result = rankProductsUnified(products, scores([["1", { specScore: 80 }]]));
      expect(result[0]?.tags).toContain("best specs");
      expect(result[0]?.tags).toContain("best value");
      expect(result[0]?.tags).toContain("cheapest");
    });

    it("handles single product with price null", () => {
      const products = [makeProduct({ id: "1", title: "a", priceChf: null })];
      const result = rankProductsUnified(products, scores([["1", { specScore: 80 }]]));
      expect(result).toHaveLength(1);
      expect(result[0]?.valueScore).toBeGreaterThanOrEqual(1);
    });

    it("handles zero price product", () => {
      const products = [makeProduct({ id: "1", title: "a", priceChf: 0 })];
      const result = rankProductsUnified(products, scores([["1", { specScore: 80 }]]));
      expect(result).toHaveLength(1);
    });

    it("handles equal spec and value scores across products", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 100 }),
        makeProduct({ id: "2", title: "b", priceChf: 100 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
      );
      expect(result).toHaveLength(2);
    });

    it("keeps low-relevance products, sinks them", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 500 }),
        makeProduct({ id: "2", title: "b", priceChf: 600 }),
      ];
      const rerankScores = new Map<string, { id: string; relevance: number }>();
      rerankScores.set("1", { id: "1", relevance: 95 });
      rerankScores.set("2", { id: "2", relevance: 5 });
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 80 }],
          ["2", { specScore: 80 }],
        ]),
        rerankScores,
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("1");
      expect(result[1]?.id).toBe("2");
      expect(result[1]?.relevance).toBe(5);
    });

    it("does not drop low-rerank products", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 500 }),
        makeProduct({ id: "2", title: "b", priceChf: 600 }),
      ];
      const specMap = scores([
        ["1", { specScore: 60 }],
        ["2", { specScore: 60 }],
      ]);
      const rerankScores = new Map([
        ["1", { id: "1", relevance: 5 }],
        ["2", { id: "2", relevance: 95 }],
      ]);
      const result = rankProductsUnified(products, specMap, rerankScores);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("2");
    });

    it("merges scorer reasons plus Condition line", () => {
      const products = [makeProduct({ id: "1", title: "a", priceChf: 500, condition: "new" })];
      const result = rankProductsUnified(
        products,
        scores([
          [
            "1",
            { specScore: 80, matchedRequirements: ["ram: 16gb"], reasons: ["Matches: ram: 16gb"] },
          ],
        ]),
      );
      expect(result[0]?.matchedRequirements).toEqual(["ram: 16gb"]);
      expect(result[0]?.reasons).toEqual(["Matches: ram: 16gb", "Condition: new"]);
    });

    it("does not re-scale specScore", () => {
      const products = [
        makeProduct({ id: "1", title: "a", priceChf: 100 }),
        makeProduct({ id: "2", title: "b", priceChf: 100 }),
      ];
      const result = rankProductsUnified(
        products,
        scores([
          ["1", { specScore: 87 }],
          ["2", { specScore: 42 }],
        ]),
      );
      expect(result.find((p) => p.id === "1")?.specScore).toBe(87);
      expect(result.find((p) => p.id === "2")?.specScore).toBe(42);
    });

    it("baseSpec fixture is well-formed", () => {
      expect(baseSpec.requirements).toHaveLength(2);
    });
  });
});
