import { describe, expect, it } from "vitest";
import { filterByDistance, haversineKm } from "./geo";
import { POSTCODES } from "./postcodes";
import type { RawProduct } from "./types";

function fakeProduct(id: string, zipCode: string | null): RawProduct {
  return {
    id,
    marketplace: "ricardo",
    title: `product ${id}`,
    priceChf: 10,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://example.com/${id}`,
    location: zipCode,
    zipCode,
    raw: {},
  };
}

describe("haversineKm", () => {
  it("computes sub-20km for nearby Zurich PLZ and >20km to Bern", () => {
    const coords = (plz: string): readonly [number, number] => {
      const entry = POSTCODES[plz];
      if (!entry) throw new Error(`missing postcode ${plz}`);
      return entry;
    };
    const zurich = coords("8000");
    const nearby = coords("8044");
    const bern = coords("3000");
    expect(haversineKm(zurich[0], zurich[1], nearby[0], nearby[1])).toBeLessThan(20);
    expect(haversineKm(zurich[0], zurich[1], bern[0], bern[1])).toBeGreaterThan(20);
  });
});

describe("filterByDistance", () => {
  it("keeps in-radius listings, drops out-of-radius ones", () => {
    const products = [fakeProduct("near", "8044"), fakeProduct("far", "3000")];
    const result = filterByDistance(products, "8000", 20);
    expect(result.map((p) => p.id)).toEqual(["near"]);
  });

  it("returns input unchanged for unknown user PLZ", () => {
    expect(POSTCODES["9999"]).toBeUndefined();
    const products = [fakeProduct("a", "8044"), fakeProduct("b", "3000")];
    expect(filterByDistance(products, "9999", 20)).toBe(products);
  });

  it("drops products with null zip", () => {
    const products = [fakeProduct("nozip", null), fakeProduct("near", "8044")];
    expect(filterByDistance(products, "8000", 20).map((p) => p.id)).toEqual(["near"]);
  });
});
