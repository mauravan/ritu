import { describe, expect, it } from "vitest";
import { sortProducts } from "./sort";
import type { RankedProduct, SortBy } from "./types";

function mk(
  id: string,
  overrides: Partial<RankedProduct> = {},
): RankedProduct {
  return {
    id,
    marketplace: "ricardo",
    title: `product ${id}`,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://ricardo.ch/${id}`,
    location: null,
    raw: {},
    specScore: 50,
    valueScore: 50,
    tags: [],
    matchedRequirements: [],
    reasons: [],
    relevance: 50,
    hybridScore: 50,
    ...overrides,
  };
}

const ids = (ps: RankedProduct[]) => ps.map((p) => p.id);

describe("sortProducts", () => {
  const fields: { by: SortBy; key: keyof RankedProduct }[] = [
    { by: "spec", key: "specScore" },
    { by: "value", key: "valueScore" },
    { by: "ai", key: "relevance" },
    { by: "hybrid", key: "hybridScore" },
    { by: "price", key: "priceChf" },
  ];

  for (const { by, key } of fields) {
    it(`orders ${by} ascending and descending`, () => {
      const products = [
        mk("a", { [key]: 30 } as Partial<RankedProduct>),
        mk("b", { [key]: 10 } as Partial<RankedProduct>),
        mk("c", { [key]: 20 } as Partial<RankedProduct>),
      ];
      expect(ids(sortProducts(products, by, "asc"))).toEqual(["b", "c", "a"]);
      expect(ids(sortProducts(products, by, "desc"))).toEqual(["a", "c", "b"]);
    });
  }

  it("sinks null price last in both directions", () => {
    const products = [
      mk("a", { priceChf: 300 }),
      mk("b", { priceChf: null }),
      mk("c", { priceChf: 100 }),
    ];
    expect(ids(sortProducts(products, "price", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortProducts(products, "price", "desc"))).toEqual(["a", "c", "b"]);
  });

  it("sinks undefined relevance last in both directions", () => {
    const products = [
      mk("a", { relevance: 90 }),
      mk("b", { relevance: undefined }),
      mk("c", { relevance: 10 }),
    ];
    expect(ids(sortProducts(products, "ai", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortProducts(products, "ai", "desc"))).toEqual(["a", "c", "b"]);
  });

  it("sinks undefined hybridScore last in both directions", () => {
    const products = [
      mk("a", { hybridScore: 80 }),
      mk("b", { hybridScore: undefined }),
      mk("c", { hybridScore: 20 }),
    ];
    expect(ids(sortProducts(products, "hybrid", "asc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortProducts(products, "hybrid", "desc"))).toEqual(["a", "c", "b"]);
  });

  it("near with zip puts zip matches first, rest alphabetical", () => {
    const products = [
      mk("a", { location: "Luzern" }),
      mk("b", { location: "8001 Zürich" }),
      mk("c", { location: "Bern" }),
      mk("d", { location: "8001 Altstetten" }),
    ];
    expect(ids(sortProducts(products, "near", "asc", "8001"))).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
  });

  it("near with zip descending flips both stages", () => {
    const products = [
      mk("a", { location: "Luzern" }),
      mk("b", { location: "8001 Zürich" }),
      mk("c", { location: "Bern" }),
      mk("d", { location: "8001 Altstetten" }),
    ];
    expect(ids(sortProducts(products, "near", "desc", "8001"))).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("near without zip is pure alphabetical", () => {
    const products = [
      mk("a", { location: "Zürich" }),
      mk("b", { location: "Bern" }),
      mk("c", { location: "Aarau" }),
    ];
    expect(ids(sortProducts(products, "near", "asc"))).toEqual(["c", "b", "a"]);
    expect(ids(sortProducts(products, "near", "desc"))).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on marketplace:id", () => {
    const products = [
      mk("b", { marketplace: "ricardo", specScore: 10 }),
      mk("a", { marketplace: "tutti", specScore: 10 }),
      mk("a", { marketplace: "ricardo", specScore: 10 }),
    ];
    expect(ids(sortProducts(products, "spec", "asc"))).toEqual(["a", "b", "a"]);
    const out = sortProducts(products, "spec", "asc");
    expect(out.map((p) => `${p.marketplace}:${p.id}`)).toEqual([
      "ricardo:a",
      "ricardo:b",
      "tutti:a",
    ]);
  });

  it("does not mutate the input array", () => {
    const products = [
      mk("a", { specScore: 30 }),
      mk("b", { specScore: 10 }),
      mk("c", { specScore: 20 }),
    ];
    const before = ids(products);
    const out = sortProducts(products, "spec", "asc");
    expect(ids(out)).toEqual(["b", "c", "a"]);
    expect(ids(products)).toEqual(before);
  });
});
