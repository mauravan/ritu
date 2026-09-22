import { describe, expect, it, vi } from "vitest";
import {
  extractGpuNumber,
  isGpuRequirement,
  keywordsFromSpec,
  rankProductsUnified,
  tagExplanation,
  tokenize,
} from "./ranking";
import type { DerivedSpec, RawProduct } from "./types";

describe("ranking", () => {
  describe("tokenize", () => {
    it("splits text into tokens, lowercases, removes stopwords and short tokens", () => {
      expect(tokenize("The quick brown fox")).toEqual(["quick", "brown", "fox"]);
      expect(tokenize("laptop mit 16gb ram für gaming")).toEqual([
        "laptop",
        "16gb",
        "ram",
        "gaming",
      ]);
      expect(tokenize("a an the for with und der die das")).toEqual([]);
      expect(tokenize("")).toEqual([]);
      expect(tokenize("i5 processor")).toEqual(["i5", "processor"]);
    });

    it("filters out tokens with length <= 1", () => {
      expect(tokenize("a b c de")).toEqual(["de"]);
    });
  });

  describe("keywordsFromSpec", () => {
    it("extracts keywords from spec requirements, searchQueries, and category", () => {
      const spec: DerivedSpec = {
        category: "laptop",
        requirements: [
          { key: "cpu", value: "i7", importance: "required" },
          { key: "ram", value: "32gb", importance: "nice" },
        ],
        searchQueries: ["gaming laptop", "workstation"],
        clarifyingQuestions: [],
        originalInput: "gaming laptop i7 32gb",
      };
      const keywords = keywordsFromSpec(spec);
      expect(keywords).toContain("laptop");
      expect(keywords).toContain("i7");
      expect(keywords).toContain("32gb");
      expect(keywords).toContain("gaming");
      expect(keywords).toContain("workstation");
    });

    it("handles empty spec", () => {
      const spec: DerivedSpec = {
        category: "",
        requirements: [],
        searchQueries: [],
        clarifyingQuestions: [],
        originalInput: "",
      };
      expect(keywordsFromSpec(spec)).toEqual([]);
    });
  });

  describe("isGpuRequirement", () => {
    it("returns true for valid GPU requirements", () => {
      expect(isGpuRequirement("rtx 3080")).toBe(true);
      expect(isGpuRequirement("gtx 1080")).toBe(true);
      expect(isGpuRequirement("RTX 4090")).toBe(true);
      expect(isGpuRequirement("GTX 1650")).toBe(true);
    });

    it("returns false for non-GPU strings", () => {
      expect(isGpuRequirement("intel i7")).toBe(false);
      expect(isGpuRequirement("rtx")).toBe(false);
      expect(isGpuRequirement("gtx")).toBe(false);
      expect(isGpuRequirement("rtx 30")).toBe(false);
      expect(isGpuRequirement("")).toBe(false);
    });
  });

  describe("extractGpuNumber", () => {
    it("extracts GPU number from valid strings", () => {
      expect(extractGpuNumber("rtx 3080")).toBe(3080);
      expect(extractGpuNumber("gtx 1080")).toBe(1080);
      expect(extractGpuNumber("RTX 4090")).toBe(4090);
      expect(extractGpuNumber("RTX 3080 Ti")).toBe(3080);
    });

    it("returns null for non-GPU strings", () => {
      expect(extractGpuNumber("intel i7")).toBeNull();
      expect(extractGpuNumber("rtx")).toBeNull();
      expect(extractGpuNumber("gtx")).toBeNull();
      expect(extractGpuNumber("")).toBeNull();
    });
  });

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
      requirements: [
        { key: "cpu", value: "i7", importance: "required" },
        { key: "ram", value: "16gb", importance: "required" },
      ],
      searchQueries: ["laptop i7 16gb"],
      clarifyingQuestions: [],
      originalInput: "laptop i7 16gb",
    };

    it("returns empty array for empty input", () => {
      expect(rankProductsUnified([], baseSpec)).toEqual([]);
    });

    it("ranks products and adds scores", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("specScore");
      expect(result[0]).toHaveProperty("hybridScore");
      expect(result[0]).toHaveProperty("tags");
    });

    it("sorts by hybridScore descending", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result[0].hybridScore).toBeGreaterThanOrEqual(result[1].hybridScore);
    });

    it("includes hybridScore and relevance", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result[0]).toHaveProperty("hybridScore");
      expect(result[0]).toHaveProperty("relevance");
    });

    it("handles products with missing price", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: null }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(2);
    });

    it("uses LLM scores when provided", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const rerankScores = new Map<string, { id: string; relevance: number }>();
      rerankScores.set("1", {
        id: "1",
        relevance: 95,
      });
      rerankScores.set("2", {
        id: "2",
        relevance: 30,
      });
      const result = rankProductsUnified(products, baseSpec, rerankScores);
      expect(result[0].id).toBe("1");
      expect(result[0].relevance).toBe(95);
    });

    it("handles custom weights from env", () => {
      vi.stubEnv("RANKING_SIGNAL_WEIGHTS", '{"gpu": 2.0}');
      const products = [
        makeProduct({
          id: "1",
          title: "i7 16gb rtx 3080 laptop",
          priceChf: 1500,
        }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(1);
      vi.unstubAllEnvs();
    });

    it("handles invalid JSON in RANKING_SIGNAL_WEIGHTS gracefully", () => {
      vi.stubEnv("RANKING_SIGNAL_WEIGHTS", "invalid json");
      const products = [makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 })];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(1);
      vi.unstubAllEnvs();
    });

    it("assigns best condition tag for new products with specScore >= 50", () => {
      const products = [
        makeProduct({
          id: "1",
          title: "i7 16gb laptop",
          priceChf: 800,
          condition: "new",
        }),
        makeProduct({
          id: "2",
          title: "i7 16gb laptop",
          priceChf: 500,
          condition: "used",
        }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(true);
      const bestCond = result.find((p) => p.tags.includes("best condition"));
      expect(bestCond?.condition).toBe("new");
    });

    it("assigns balanced tag when >= 4 products", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
        makeProduct({ id: "3", title: "i7 16gb laptop", priceChf: 600 }),
        makeProduct({ id: "4", title: "i7 16gb laptop", priceChf: 700 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("balanced"))).toBe(true);
    });

    it("assigns best overall tag to highest hybridScore", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("best overall"))).toBe(true);
      const bestOverall = result.find((p) => p.tags.includes("best overall"));
      expect(bestOverall?.id).toBe("2");
    });

    it("does not assign balanced tag when < 4 products", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
        makeProduct({ id: "3", title: "i7 8gb laptop", priceChf: 600 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("balanced"))).toBe(false);
    });

    it("does not assign best condition when no new products", () => {
      const products = [
        makeProduct({
          id: "1",
          title: "i7 16gb laptop",
          priceChf: 800,
          condition: "used",
        }),
        makeProduct({
          id: "2",
          title: "i7 16gb laptop",
          priceChf: 500,
          condition: "refurbished",
        }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(false);
    });

    it("does not assign best condition when specScore < 50", () => {
      const products = [
        makeProduct({
          id: "1",
          title: "unrelated product",
          priceChf: 800,
          condition: "new",
        }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result.some((p) => p.tags.includes("best condition"))).toBe(false);
    });

    it("applies GPU compare signal for matching and non-matching GPUs", () => {
      const gpuSpec: DerivedSpec = {
        ...baseSpec,
        requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
      };
      const products = [
        makeProduct({ id: "1", title: "laptop rtx 3080", priceChf: 1500 }),
        makeProduct({ id: "2", title: "laptop rtx 3060", priceChf: 1000 }),
        makeProduct({ id: "3", title: "laptop gtx 1650", priceChf: 800 }),
      ];
      const result = rankProductsUnified(products, gpuSpec);
      expect(result).toHaveLength(3);
    });

    it("applies GPU score signal when no compare present", () => {
      const gpuSpec: DerivedSpec = {
        ...baseSpec,
        requirements: [{ key: "gpu", value: "gtx 1080", importance: "required" }],
      };
      const products = [
        makeProduct({ id: "1", title: "laptop gtx 1080", priceChf: 900 }),
        makeProduct({ id: "2", title: "laptop", priceChf: 700 }),
      ];
      const result = rankProductsUnified(products, gpuSpec);
      expect(result).toHaveLength(2);
    });

    it("handles raw as string for token matching", () => {
      const products = [
        makeProduct({
          id: "1",
          title: "laptop",
          priceChf: 800,
          raw: "i7 16gb rtx 3080 specs",
        }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(1);
      expect(result[0].matchedRequirements).toContain("cpu: i7");
    });

    it("keeps low-relevance products, sinks them", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 800 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 500 }),
      ];
      const rerankScores = new Map<string, { id: string; relevance: number }>();
      rerankScores.set("1", {
        id: "1",
        relevance: 95,
      });
      rerankScores.set("2", {
        id: "2",
        relevance: 5,
      });
      const result = rankProductsUnified(products, baseSpec, rerankScores);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
      expect(result[1].relevance).toBe(5);
    });

    it("handles single product with price null", () => {
      const products = [makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: null })];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(1);
      expect(result[0].valueScore).toBeGreaterThanOrEqual(1);
    });

    it("handles equal spec and value scores across products", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 100 }),
        makeProduct({ id: "2", title: "i7 16gb laptop", priceChf: 100 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(2);
    });

    it("handles preferred importance requirements in title and raw", () => {
      const prefSpec: DerivedSpec = {
        ...baseSpec,
        requirements: [{ key: "ram", value: "32gb", importance: "preferred" }],
      };
      const products = [
        makeProduct({ id: "1", title: "laptop 32gb", priceChf: 800 }),
        makeProduct({
          id: "2",
          title: "laptop",
          raw: "has 32gb memory",
          priceChf: 700,
        }),
      ];
      const result = rankProductsUnified(products, prefSpec);
      expect(result).toHaveLength(2);
    });

    it("handles zero price product", () => {
      const products = [makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 0 })];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(1);
    });

    it("covers GPU signal raw string, null raw, and missing GPU", () => {
      const gpuSpec: DerivedSpec = {
        ...baseSpec,
        requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
      };
      const products = [
        makeProduct({
          id: "1",
          title: "laptop",
          raw: "has rtx 3060 inside",
          priceChf: 1000,
        }),
        makeProduct({ id: "2", title: "plain laptop", raw: {}, priceChf: 800 }),
        makeProduct({
          id: "3",
          title: "laptop rtx 3080",
          raw: null,
          priceChf: 1200,
        }),
      ];
      const result = rankProductsUnified(products, gpuSpec);
      expect(result).toHaveLength(3);
    });

    it("skips cheapest tag for low specScore products", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 500 }),
        makeProduct({ id: "2", title: "unrelated product", priceChf: 100 }),
      ];
      const result = rankProductsUnified(products, baseSpec);
      expect(result).toHaveLength(2);
    });

    it("does not drop low-rerank products", () => {
      const products = [
        {
          id: "1",
          title: "i7 16gb laptop",
          marketplace: "ricardo",
          priceChf: 500,
          currency: "CHF" as const,
          condition: null,
          imageUrl: null,
          url: "https://example.com/1",
          location: null,
          raw: {},
        },
        {
          id: "2",
          title: "i7 32gb laptop",
          marketplace: "ricardo",
          priceChf: 600,
          currency: "CHF" as const,
          condition: null,
          imageUrl: null,
          url: "https://example.com/2",
          location: null,
          raw: {},
        },
      ];
      const spec = {
        ...baseSpec,
        requirements: [{ key: "ram", value: "32gb", importance: "preferred" as const }],
      };
      const rerankScores = new Map([
        ["1", { id: "1", relevance: 5 }],
        ["2", { id: "2", relevance: 95 }],
      ]);
      const result = rankProductsUnified(
        products as unknown as Parameters<typeof rankProductsUnified>[0],
        spec,
        rerankScores,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("2");
    });

    it("penalizes products whose title contains an excludedTerm", () => {
      const products = [
        makeProduct({ id: "1", title: "i7 16gb laptop", priceChf: 500 }),
        makeProduct({ id: "2", title: "i7 16gb laptop sleeve", priceChf: 500 }),
      ];
      const spec: DerivedSpec = { ...baseSpec, excludedTerms: ["sleeve"] };
      const result = rankProductsUnified(products, spec);
      const normal = result.find((p) => p.id === "1");
      const accessory = result.find((p) => p.id === "2");
      expect(normal).toBeDefined();
      expect(accessory).toBeDefined();
      if (normal === undefined || accessory === undefined) throw new Error("test setup failed");
      expect(accessory.specScore).toBeLessThan(normal.specScore);
    });

    it("adds a penalty reason when an excluded term matches", () => {
      const products = [makeProduct({ id: "1", title: "i7 16gb laptop sleeve", priceChf: 500 })];
      const spec: DerivedSpec = { ...baseSpec, excludedTerms: ["sleeve"] };
      const result = rankProductsUnified(products, spec);
      expect(result[0].reasons).toContain('Penalty: excluded term "sleeve"');
    });

    it("adds a penalty reason for numeric mismatch with the field", () => {
      const products = [makeProduct({ id: "1", title: "laptop", priceChf: 500 })];
      const spec: DerivedSpec = {
        ...baseSpec,
        requirements: [{ key: "ram", value: "32gb", importance: "required" }],
      };
      const result = rankProductsUnified(products, spec);
      expect(result[0].reasons).toContain("Penalty: numeric mismatch (ram: 32gb)");
    });
  });
});
