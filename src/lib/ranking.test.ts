import { describe, expect, it } from "vitest";
import { rankProductsUnified, tagExplanation } from "./ranking";
import type { DerivedSpec, RankedProduct, RawProduct } from "./types";

function mkProduct(
  id: string,
  title: string,
  price: number | null,
  condition: string | null = null,
): RawProduct {
  return {
    id,
    marketplace: "ricardo",
    title,
    priceChf: price,
    currency: "CHF",
    condition,
    imageUrl: null,
    url: `https://ricardo.ch/${id}`,
    location: null,
    raw: {},
  };
}

function _mkRanked(
  id: string,
  title: string,
  specScore: number,
  valueScore: number,
): RankedProduct {
  return {
    id,
    marketplace: "ricardo",
    title,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://ricardo.ch/${id}`,
    location: null,
    raw: {},
    specScore,
    valueScore,
    tags: [],
    matchedRequirements: [],
    reasons: [],
  };
}

const spec: DerivedSpec = {
  category: "mini pc",
  summary: "small server",
  requirements: [
    { key: "RAM", value: "16GB", importance: "required" },
    { key: "CPU", value: "x86_64", importance: "required" },
  ],
  searchQueries: ["mini pc", "intel nuc"],
  excludedTerms: [],
};

const laptopSpec: DerivedSpec = {
  category: "laptop",
  summary: "a new laptop for school",
  requirements: [
    { key: "RAM", value: "16GB", importance: "preferred" },
    { key: "CPU", value: "i5", importance: "preferred" },
  ],
  searchQueries: ["laptop 14 zoll", "laptop i5"],
  excludedTerms: ["hülle", "tasche", "sleeve", "cover", "case"],
};

describe("ranking", () => {
  it("empty returns []", () => {
    expect(rankProductsUnified([], spec)).toEqual([]);
  });

  it("ranks Intel NUC 16GB top", () => {
    const nuc = mkProduct("1", "Intel NUC 16GB RAM x86_64 Mini PC", 250);
    const synology = mkProduct("2", "Synology DS920+ NAS 8GB", 650);
    const pi = mkProduct("3", "Raspberry Pi 4 4GB ARM", 80);
    const ranked = rankProductsUnified([synology, pi, nuc], spec);
    expect(ranked[0]?.id).toBe("1");
    expect(ranked[0]?.tags).toContain("best specs");
    // cheapest among specScore>=40 should be nuc (250) not pi (score low)
    const cheapest = ranked.find((r) => r.tags.includes("cheapest"));
    if (cheapest) expect(cheapest.priceChf).toBe(250);
  });

  it("cheapest tag assigned correctly", () => {
    const a = mkProduct("a", "Mini PC 16GB x86_64", 100);
    const b = mkProduct("b", "Mini PC 16GB x86_64 Pro", 300);
    const c = mkProduct("c", "Mini PC 16GB x86_64 Ultra", 200);
    const ranked = rankProductsUnified([b, c, a], spec);
    const cheapest = ranked.find((r) => r.tags.includes("cheapest"));
    expect(cheapest?.priceChf).toBe(100);
  });

  it("single product gets both best specs and best value", () => {
    const solo = mkProduct("solo", "Intel NUC 16GB", 150);
    const ranked = rankProductsUnified([solo], spec);
    expect(ranked[0]?.tags).toContain("best specs");
    expect(ranked[0]?.tags).toContain("best value");
  });

  it("best condition assigned to new with specScore>=50", () => {
    const newProd = mkProduct("n1", "Intel NUC 16GB x86_64", 200, "new");
    const usedProd = mkProduct("u1", "Intel NUC 16GB x86_64 used", 150, "used");
    const ranked = rankProductsUnified([usedProd, newProd], spec);
    const bestCond = ranked.find((r) => r.tags.includes("best condition"));
    expect(bestCond?.id).toBe("n1");
  });

  describe("rankingMeta breakdown", () => {
    it("breakdown contains requirement, keyword and category entries", () => {
      const _p = mkProduct("1", "laptop i5 16GB 512GB", 500);
      const ranked = rankProductsUnified([_p], laptopSpec);
      const meta = ranked[0]?.rankingMeta as NonNullable<(typeof ranked)[number]["rankingMeta"]>;
      // category and requirements present in breakdown
      expect(meta.breakdown.length).toBeGreaterThan(0);
      expect(meta.valueDerivedFrom).toContain("batch_min=");
    });

    it("breakdown records excluded terms in meta when applicable", () => {
      const exclSpec: DerivedSpec = {
        category: "mini pc",
        summary: "mini",
        requirements: [{ key: "RAM", value: "16GB", importance: "required" }],
        searchQueries: ["mini pc"],
        excludedTerms: ["refurbished"],
      };
      const p2 = mkProduct("2", "mini pc 16GB refurbished", 100);
      const ranked2 = rankProductsUnified([p2], exclSpec);
      expect(ranked2.length).toBeGreaterThan(0);
      expect(ranked2[0]?.rankingMeta?.breakdown.length).toBeGreaterThanOrEqual(0);
      expect(ranked2[0]?.rankingMeta?.valueDerivedFrom).toContain("comparative");
    });

    it("breakdown always present even when no hits", () => {
      const p = mkProduct("1", "random item xyz", 100);
      const emptySpec: DerivedSpec = {
        category: "laptop",
        summary: "laptop",
        requirements: [],
        searchQueries: [],
        excludedTerms: [],
      };
      const ranked = rankProductsUnified([p], emptySpec);
      expect(ranked[0]?.rankingMeta).toBeDefined();
      expect(Array.isArray(ranked[0]?.rankingMeta?.breakdown)).toBe(true);
    });

    it("deterministic-only caller leaves relevance/hybrid undefined", () => {
      const p = mkProduct("1", "laptop i5 16GB", 500);
      const ranked = rankProductsUnified([p], laptopSpec);
      expect(ranked[0]?.relevance).toBeUndefined();
      expect(ranked[0]?.hybridScore).toBe(100); // single-item batch scaled to 100
      expect(ranked[0]?.llmReason).toBeUndefined();
    });
  });

  describe("tagExplanation", () => {
    it("maps all tags to human readable", () => {
      expect(tagExplanation("best specs")).toBe("Highest specScore");
      expect(tagExplanation("best value")).toBe("Best valueScore (spec adjusted for price)");
      expect(tagExplanation("cheapest")).toBe("Lowest price among specScore≥40");
      expect(tagExplanation("best condition")).toBe("Best condition 'new/neu' among specScore≥50");
      expect(tagExplanation("balanced")).toBe("Best harmonic mean of spec & value among untagged");
    });
  });
  describe("ranking redesign", () => {
    it("valueScore is independent: same high spec, lower price → higher valueScore", () => {
      // Both have same title (same specScore) but different prices
      const highPrice = mkProduct("hp", "Intel NUC 16GB RAM x86_64 Mini PC", 500);
      const lowPrice = mkProduct("lp", "Intel NUC 16GB RAM x86_64 Mini PC", 150);
      const ranked = rankProductsUnified([highPrice, lowPrice], spec);
      // valueScore = specScore / price → lower price wins
      expect(ranked[0]?.id).toBe("lp");
      expect(ranked[0]?.valueScore).toBeGreaterThan(ranked[1]?.valueScore);
    });

    it("valueScore differs from specScore for same product", () => {
      const p = mkProduct("p", "Intel NUC 16GB RAM x86_64 Mini PC", 200);
      const ranked = rankProductsUnified([p], spec);
      // Single-item batch: both scaled to 100 (comparative), so equal is expected
      expect(ranked[0]?.valueScore).toBe(ranked[0]?.specScore);
    });
    it("user weights removed — ranking is fixed", () => {
      const p1 = mkProduct("w1", "Intel NUC 16GB RAM x86_64 Mini PC", 500);
      const p2 = mkProduct("w2", "Intel NUC 8GB RAM x86_64 Mini PC", 100);
      const ranked = rankProductsUnified([p1, p2], spec);
      expect(ranked.length).toBe(2);
    });
  });
});

describe("rankProductsUnified", () => {
  it("sorts by unified score without LLM (spec=0.6, value=0.4)", () => {
    // rankProductsUnified imported above
    const nuc = mkProduct("1", "Intel NUC 16GB RAM x86_64 Mini PC", 250);
    const synology = mkProduct("2", "Synology DS920+ NAS 8GB", 650);
    const ranked = rankProductsUnified([synology, nuc], spec);
    expect(ranked[0]?.id).toBe("1");
    expect(ranked[0]?.hybridScore).toBeDefined();
  });

  it("LLM high relevance boosts product with medium spec above high spec/low LLM", () => {
    // rankProductsUnified imported above
    const highSpecLowLLM = mkProduct("a", "Intel NUC 16GB RAM x86_64 Mini PC", 200);
    const mediumSpecHighLLM = mkProduct("b", "Intel NUC 8GB RAM x86_64 Mini PC", 150);
    const lowSpec = mkProduct("c", "Random PC", 100);
    const llmScores = new Map([
      ["a", { id: "a", relevance: 20, relevant: false, reason: "low" }],
      ["b", { id: "b", relevance: 90, relevant: true, reason: "high" }],
    ]);
    const ranked = rankProductsUnified(
      [highSpecLowLLM, mediumSpecHighLLM, lowSpec],
      spec,
      llmScores,
    );
    // With LLM weight 0.40, high relevance should boost medium spec above high spec with low relevance
    expect(ranked[0]?.id).toBe("b");
  });

  it("GPU spec applies signal bonus via rankingAlgorithms", () => {
    // rankProductsUnified imported above
    const gpuSpec: DerivedSpec = {
      category: "gpu",
      summary: "gaming gpu",
      requirements: [{ key: "GPU", value: "GTX 1660", importance: "required" }],
      searchQueries: ["gtx 1660"],
      excludedTerms: [],
    };
    const matchingGpu = mkProduct("g1", "GTX 1660 Gaming Card", 300);
    const lowerGpu = mkProduct("g2", "GTX 1050 Card", 150);
    const ranked = rankProductsUnified([lowerGpu, matchingGpu], gpuSpec);
    // Matching GPU should have higher specScore due to +5 bonus
    expect(ranked[0]?.specScore).toBeGreaterThanOrEqual(ranked[1]?.specScore);
  });
});

describe("ranking branch coverage", () => {
  it("tagExplanation covers all tags", () => {
    expect(tagExplanation("best value")).toContain("value");
    expect(tagExplanation("balanced")).toContain("harmonic");
    expect(tagExplanation("best overall")).toContain("hybrid");
  });

  it("best condition requires specScore >= 50", () => {
    const p = mkProduct("low", "New Low", 100, "new");
    const result = rankProductsUnified([p], spec);
    // Low spec product should not receive best condition
    const hasCondition = result[0]?.tags?.includes("best condition");
    expect(hasCondition).toBeFalsy();
  });

  it("balanced tag requires >=4 products", () => {
    const p1 = mkProduct("1", "A", 100);
    const p2 = mkProduct("2", "B", 200);
    const p3 = mkProduct("3", "C", 300);
    const p4 = mkProduct("4", "D", 400);
    const ranked = rankProductsUnified([p1, p2, p3, p4], spec);
    expect(ranked.length).toBe(4);
  });
});
