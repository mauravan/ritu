import { describe, expect, it } from "vitest";
import { applyNumericFilter } from "./numericFilter";
import { parseRequirementValue, parseSingleRequirementValue } from "./parseRequirementValue";
import type { DerivedSpec, RawProduct } from "./types";

function mkProduct(id: string, title: string): RawProduct {
  return {
    id,
    marketplace: "ricardo",
    title,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://x/${id}`,
    location: null,
    raw: {},
  };
}

function mkSpec(values: { value: string; importance: "required" | "preferred" }[]): DerivedSpec {
  return {
    category: "laptop",
    summary: "need",
    requirements: values.map((v, i) => ({ key: `k${i}`, ...v })),
    searchQueries: ["laptop"],
    excludedTerms: [],
  };
}

describe("parseRequirementValue branches", () => {
  it("parses at-least/minimum/maximum forms with units", () => {
    expect(parseRequirementValue("at least 16 GB")).toMatchObject({
      operator: ">=",
      numericValue: 16,
      unit: "GB",
    });
    expect(parseRequirementValue("minimum 8GB")).toMatchObject({
      operator: ">=",
      numericValue: 8,
    });
    expect(parseRequirementValue("max 4 kg")).toMatchObject({ operator: "<=", numericValue: 4 });
    expect(parseRequirementValue("up to 10 inch")).toMatchObject({
      operator: "<=",
      numericValue: 10,
    });
  });

  it("parses plus-suffix as >= and plain numbers as =", () => {
    expect(parseRequirementValue("16GB+")).toMatchObject({ operator: ">=", numericValue: 16 });
    expect(parseRequirementValue("16 GB")).toMatchObject({ operator: "=", numericValue: 16 });
  });

  it("parses thousands separators and decimals", () => {
    expect(parseRequirementValue("1,000").numericValue).toBe(1000);
    expect(parseRequirementValue("1,5 kg").numericValue).toBeCloseTo(1.5);
  });

  it("splits compound options on or, slash and semicolon", () => {
    expect(parseRequirementValue("Intel i5 or AMD Ryzen 5").compoundOptions).toEqual([
      "Intel i5",
      "AMD Ryzen 5",
    ]);
    expect(parseRequirementValue("red/blue").compoundOptions).toEqual(["red", "blue"]);
    expect(parseRequirementValue("a; b").compoundOptions).toEqual(["a", "b"]);
  });

  it("returns single-value compound passthrough when options given directly", () => {
    expect(
      parseSingleRequirementValue("Intel i5", ["Intel i5", "AMD Ryzen 5"]).compoundOptions,
    ).toEqual(["Intel i5", "AMD Ryzen 5"]);
  });

  it("extracts fallback units from text", () => {
    expect(parseRequirementValue("fast 5 ghz chip").unit).toBe("ghz");
    expect(parseRequirementValue("plain keyword").numericValue).toBe(0);
  });
});

describe("applyNumericFilter branches", () => {
  it("keeps product passing required numeric with bonus", () => {
    const { included, penalties } = applyNumericFilter(
      [mkProduct("p1", "Laptop 16GB RAM")],
      mkSpec([{ value: "at least 16 GB", importance: "required" }]),
    );
    expect(included.map((p) => p.id)).toEqual(["p1"]);
    expect(penalties.get("p1")).toBeGreaterThan(0);
  });

  it("excludes product failing required numeric", () => {
    const { included } = applyNumericFilter(
      [mkProduct("p1", "Laptop 8GB RAM")],
      mkSpec([{ value: "at least 16 GB", importance: "required" }]),
    );
    expect(included).toEqual([]);
  });

  it("penalizes but keeps product failing preferred numeric", () => {
    const { included, penalties } = applyNumericFilter(
      [mkProduct("p1", "Laptop 8GB RAM")],
      mkSpec([{ value: "at least 16 GB", importance: "preferred" }]),
    );
    expect(included.map((p) => p.id)).toEqual(["p1"]);
    expect(penalties.get("p1")).toBeLessThan(0);
  });
  it("records the requirement field for numeric penalties", () => {
    const { penaltyFields } = applyNumericFilter(
      [mkProduct("p1", "Laptop 8GB RAM")],
      mkSpec([{ value: "at least 16 GB", importance: "preferred" }]),
    );
    expect(penaltyFields.get("p1")).toEqual(["k0: at least 16 GB"]);
  });

  it("penalizes missing numeric and skips GPU/compound/zero requirements", () => {
    const { included, penalties } = applyNumericFilter(
      [mkProduct("p1", "Nice laptop bag")],
      mkSpec([
        { value: "at least 16 GB", importance: "preferred" },
        { value: "RTX 4060", importance: "required" },
        { value: "Intel i5 or AMD Ryzen 5", importance: "required" },
        { value: "plain keyword", importance: "required" },
      ]),
    );
    expect(included.map((p) => p.id)).toEqual(["p1"]);
    expect(penalties.get("p1")).toBeLessThan(0);
  });

  it("handles unit mismatch as fail and <= operator pass", () => {
    const fail = applyNumericFilter(
      [mkProduct("p1", "Disk 500 GB")],
      mkSpec([{ value: "at least 1 TB", importance: "required" }]),
    );
    expect(fail.included).toEqual([]);
    const pass = applyNumericFilter(
      [mkProduct("p1", "Disk 500 GB")],
      mkSpec([{ value: "max 1 TB", importance: "preferred" }]),
    );
    expect(pass.included.map((p) => p.id)).toEqual(["p1"]);
  });

  it("handles strict > and < operators", () => {
    const over = applyNumericFilter(
      [mkProduct("p1", "16 units")],
      mkSpec([{ value: "at least 16", importance: "required" }]),
    );
    expect(over.included.map((p) => p.id)).toEqual(["p1"]);
    const eq = applyNumericFilter(
      [mkProduct("p1", "16 units")],
      mkSpec([{ value: "16", importance: "required" }]),
    );
    expect(eq.included.map((p) => p.id)).toEqual(["p1"]);
  });
});
