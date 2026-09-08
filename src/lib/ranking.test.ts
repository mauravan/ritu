import { describe, it, expect } from "vitest";
import { rankProducts } from "./ranking";
import type { RawProduct, DerivedSpec } from "./types";

function mkProduct(id: string, title: string, price: number | null, condition: string | null = null): RawProduct {
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

describe("ranking", () => {
  it("empty returns []", () => {
    expect(rankProducts([], spec)).toEqual([]);
  });

  it("ranks Intel NUC 16GB top", () => {
    const nuc = mkProduct("1", "Intel NUC 16GB RAM x86_64 Mini PC", 250);
    const synology = mkProduct("2", "Synology DS920+ NAS 8GB", 650);
    const pi = mkProduct("3", "Raspberry Pi 4 4GB ARM", 80);
    const ranked = rankProducts([synology, pi, nuc], spec);
    expect(ranked[0]!.id).toBe("1");
    expect(ranked[0]!.tags).toContain("best specs");
    // cheapest among specScore>=40 should be nuc (250) not pi (score low)
    const cheapest = ranked.find((r) => r.tags.includes("cheapest"));
    if (cheapest) expect(cheapest.priceChf).toBe(250);
  });

  it("cheapest tag assigned correctly", () => {
    const a = mkProduct("a", "Mini PC 16GB x86_64", 100);
    const b = mkProduct("b", "Mini PC 16GB x86_64 Pro", 300);
    const c = mkProduct("c", "Mini PC 16GB x86_64 Ultra", 200);
    const ranked = rankProducts([b, c, a], spec);
    const cheapest = ranked.find((r) => r.tags.includes("cheapest"));
    expect(cheapest?.priceChf).toBe(100);
  });

  it("single product gets both best specs and best value", () => {
    const solo = mkProduct("solo", "Intel NUC 16GB", 150);
    const ranked = rankProducts([solo], spec);
    expect(ranked[0]!.tags).toContain("best specs");
    expect(ranked[0]!.tags).toContain("best value");
  });

  it("best condition assigned to new with specScore>=50", () => {
    const newProd = mkProduct("n1", "Intel NUC 16GB x86_64", 200, "new");
    const usedProd = mkProduct("u1", "Intel NUC 16GB x86_64 used", 150, "used");
    const ranked = rankProducts([usedProd, newProd], spec);
    const bestCond = ranked.find((r) => r.tags.includes("best condition"));
    expect(bestCond?.id).toBe("n1");
  });
});
