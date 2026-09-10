import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import type { RawProduct } from "./types";

function p(
  id: string,
  title: string,
  price: number | null,
  marketplace: "ricardo" | "tutti" = "ricardo",
  raw?: unknown,
): RawProduct {
  return {
    id,
    marketplace,
    title,
    priceChf: price,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `http://example/${id}`,
    location: null,
    raw: raw ?? { id },
  };
}

describe("aggregate contracts", () => {
  it("same title+same price keeps first entry", () => {
    const a = p("1", "Laptop", 500);
    const b = p("2", "Laptop", 500);
    expect(aggregate([[a, b]])).toHaveLength(1);
    expect(aggregate([[a, b]])[0]?.id).toBe("1");
  });

  it("same title, different prices are separate keys", () => {
    const a = p("1", "Laptop", null);
    const b = p("2", "Laptop", 300);
    const result = aggregate([[a, b]]);
    // Keys include price: "laptop|null" vs "laptop|300"
    expect(result).toHaveLength(2);
  });
  it("exact id dedup overrides same-key logic", () => {
    const a = p("1", "Laptop", 500);
    const b = p("1", "Laptop", 300); // same id different price
    const result = aggregate([[a, b]]);
    expect(result).toHaveLength(1);
    expect(result[0]?.priceChf).toBe(500); // first id wins in exact-id dedup
  });

  it("empty array returns []", () => {
    expect(aggregate([])).toEqual([]);
  });

  it("normalizeTitle strips non-alphanumeric", () => {
    const a = p("1", "Laptop Pro! 2024", 100);
    const b = p("2", "laptop pro 2024", 200);
    // Different prices → different keys, both kept
    const result = aggregate([[a, b]]);
    expect(result).toHaveLength(2);
  });
});
