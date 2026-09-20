import { describe, expect, it } from "vitest";
import { aggregate, normalizeTitle } from "./aggregate";
import type { RawProduct } from "./types";

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

describe("aggregate", () => {
  describe("normalizeTitle", () => {
    it("normalizes title to lowercase", () => {
      expect(normalizeTitle("Test Product")).toBe("test product");
    });

    it("removes special characters", () => {
      expect(normalizeTitle("Test @#$% Product!")).toBe("test product");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeTitle("test   product")).toBe("test product");
    });

    it("trims whitespace", () => {
      expect(normalizeTitle("  test product  ")).toBe("test product");
    });

    it("handles empty string", () => {
      expect(normalizeTitle("")).toBe("");
    });
  });

  describe("aggregate", () => {
    it("returns empty array for empty input", () => {
      expect(aggregate([])).toEqual([]);
      expect(aggregate([[]])).toEqual([]);
    });

    it("deduplicates by title and price (same key)", () => {
      const products = [
        makeProduct({ id: "1", title: "iPhone 15", priceChf: 800 }),
        makeProduct({ id: "2", title: "iPhone 15", priceChf: 800 }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(1);
    });

    it("keeps both when same title different prices (different keys)", () => {
      const products = [
        makeProduct({ id: "1", title: "iPhone 15", priceChf: 800 }),
        makeProduct({ id: "2", title: "iPhone 15", priceChf: 700 }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(2);
    });

    it("keeps both when one has null price (different keys)", () => {
      const products = [
        makeProduct({ id: "1", title: "iPhone 15", priceChf: null }),
        makeProduct({ id: "2", title: "iPhone 15", priceChf: 700 }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(2);
    });

    it("keeps existing when both have null price (same key)", () => {
      const products = [
        makeProduct({ id: "1", title: "iPhone 15", priceChf: null }),
        makeProduct({ id: "1", title: "iPhone 15", priceChf: null }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("keeps existing when new has null price and existing has price (different keys)", () => {
      const products = [
        makeProduct({ id: "1", title: "iPhone 15", priceChf: 700 }),
        makeProduct({ id: "2", title: "iPhone 15", priceChf: null }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(2);
    });

    it("deduplicates by id across marketplaces", () => {
      const products = [
        makeProduct({
          id: "1",
          marketplace: "ricardo",
          title: "iPhone 15",
          priceChf: 800,
        }),
        makeProduct({
          id: "1",
          marketplace: "tutti",
          title: "iPhone 15",
          priceChf: 800,
        }),
      ];
      const result = aggregate([products]);
      expect(result).toHaveLength(1);
    });

    it("handles multiple groups", () => {
      const group1 = [makeProduct({ id: "1", title: "iPhone 15", priceChf: 800 })];
      const group2 = [makeProduct({ id: "1", title: "iPhone 15", priceChf: 700 })];
      const result = aggregate([group1, group2]);
      expect(result).toHaveLength(1);
      expect(result[0].priceChf).toBe(800); // first one wins in second pass
    });
    it("preserves all fields of kept product", () => {
      const products = [
        makeProduct({
          id: "1",
          title: "iPhone 15 Pro",
          priceChf: 1000,
          condition: "new",
          imageUrl: "https://example.com/img.jpg",
          url: "https://example.com/1",
          location: "Zurich",
        }),
        makeProduct({ id: "1", title: "iPhone 15 Pro", priceChf: 900 }),
      ];
      const result = aggregate([products]);
      expect(result[0].title).toBe("iPhone 15 Pro");
      expect(result[0].condition).toBe("new");
      expect(result[0].imageUrl).toBe("https://example.com/img.jpg");
      expect(result[0].location).toBe("Zurich");
    });
  });
});
