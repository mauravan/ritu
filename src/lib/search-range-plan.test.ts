import { describe, expect, it } from "vitest";
import { applyNumericFilter } from "./numericFilter";
import { parseRequirementValue } from "./parseRequirementValue";
import { augmentSearchQueries } from "./searchMarketplaces";
import type { DerivedSpec, RawProduct } from "./types";

describe("parseRequirementValue", () => {
  it("parses exact values", () => {
    expect(parseRequirementValue("32GB")).toEqual({
      operator: "=",
      numericValue: 32,
      unit: "GB",
    });
  });

  it("parses at least ranges", () => {
    expect(parseRequirementValue("at least 16GB RAM")).toEqual({
      operator: ">=",
      numericValue: 16,
      unit: "GB",
    });
  });

  it("parses maximum constraints", () => {
    expect(parseRequirementValue("maximum 1TB")).toEqual({
      operator: "<=",
      numericValue: 1,
      unit: "TB",
    });
  });

  it("parses compound OR requirements", () => {
    const parsed = parseRequirementValue("Intel i5 or AMD Ryzen 5");
    expect(parsed.compoundOptions).toEqual(["Intel i5", "AMD Ryzen 5"]);
  });

  it("defaults to equality when no operator present", () => {
    expect(parseRequirementValue("64GB SSD")).toEqual({
      operator: "=",
      numericValue: 64,
      unit: "GB",
    });
  });
  it("parses attached + as >= (regression for 32GB+)", () => {
    expect(parseRequirementValue("32GB+")).toEqual({
      operator: ">=",
      numericValue: 32,
      unit: "GB",
    });
  });
});

describe("numericFilter", () => {
  it("excludes products below required numeric threshold", () => {
    const products: RawProduct[] = [
      {
        id: "1",
        title: "laptop 8gb",
        marketplace: "ricardo",
        priceChf: 500,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
      {
        id: "2",
        title: "laptop 32gb",
        marketplace: "ricardo",
        priceChf: 600,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
    ];
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [{ key: "ram", value: "32gb", importance: "required" }],
      searchQueries: ["laptop"],
      excludedTerms: [],
    };
    const result = applyNumericFilter(products, spec);
    expect(result.included.map((p) => p.id)).toEqual(["2"]);
  });

  it("applies preferred penalty instead of hard exclusion", () => {
    const products: RawProduct[] = [
      {
        id: "1",
        title: "laptop 8gb",
        marketplace: "ricardo",
        priceChf: 500,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
      {
        id: "2",
        title: "laptop 32gb",
        marketplace: "ricardo",
        priceChf: 600,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
    ];
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [{ key: "ram", value: "32gb", importance: "preferred" }],
      searchQueries: ["laptop"],
      excludedTerms: [],
    };
    const result = applyNumericFilter(products, spec);
    expect(result.included.length).toBe(2);
    expect(result.penalties.has("1")).toBe(true);
  });

  it("skips compound OR for numeric comparison", () => {
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [
        {
          key: "cpu",
          value: "Intel i5 or AMD Ryzen 5",
          importance: "required",
        },
      ],
      searchQueries: ["laptop"],
      excludedTerms: [],
    };
    const products: RawProduct[] = [
      {
        id: "1",
        title: "laptop i5",
        marketplace: "ricardo",
        priceChf: 400,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
    ];
    const result = applyNumericFilter(products, spec);
    expect(result.included.length).toBe(1);
  });

  it("skips GPU requirements handled by signal registry", () => {
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [{ key: "gpu", value: "rtx 3080", importance: "required" }],
      searchQueries: ["laptop"],
      excludedTerms: [],
    };
    const products: RawProduct[] = [
      {
        id: "1",
        title: "laptop rtx 3080",
        marketplace: "ricardo",
        priceChf: 1500,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
      {
        id: "2",
        title: "plain laptop",
        marketplace: "ricardo",
        priceChf: 800,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "",
        location: null,
        raw: {},
      },
    ];
    const result = applyNumericFilter(products, spec);
    expect(result.included.length).toBe(2); // GPU signal handles comparison, not numeric exclusion
  });
});

describe("compound marketplace queries", () => {
  it("expands compound OR into multiple query variants", () => {
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [
        {
          key: "cpu",
          value: "Intel i5 or AMD Ryzen 5",
          importance: "required",
        },
      ],
      searchQueries: ["laptop"],
      excludedTerms: [],
    };
    const expanded = augmentSearchQueries(["laptop"], spec);
    expect(expanded).toContain("laptop Intel i5");
    expect(expanded).toContain("laptop AMD Ryzen 5");
  });

  it("excludes numeric/minimum terms from marketplace URLs", () => {
    const spec: DerivedSpec = {
      category: "laptop",
      summary: "test",
      requirements: [
        { key: "cpu", value: "i7", importance: "required" },
        { key: "ram", value: "at least 32GB", importance: "required" },
      ],
      searchQueries: ["laptop i7"],
      excludedTerms: [],
    };
    const expanded = augmentSearchQueries(["laptop i7"], spec);
    expect(expanded.some((q) => q.toLowerCase().includes("32gb"))).toBe(false);
  });
});
