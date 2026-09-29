import { afterEach, describe, expect, it } from "vitest";
import {
  emptyFavorites,
  FAVORITES_STORAGE_KEY,
  formatSavedAt,
  loadFavorites,
  saveFavorites,
  toFavoriteListing,
} from "@/lib/favorites";
import type { RawProduct } from "@/lib/types";

const PRODUCT: RawProduct = {
  id: "p1",
  marketplace: "tutti",
  title: "MacBook",
  priceChf: 900,
  currency: "CHF",
  condition: "used",
  imageUrl: "https://img",
  url: "https://tutti.ch/p1",
  bidPriceChf: null,
  listedPriceChf: null,
  location: "Bern",
  zipCode: "3000",
  raw: {},
};

describe("favorites lib", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips categories and items through storage", () => {
    const state = {
      categories: ["Laptops", "Phones"],
      items: [
        {
          id: "a",
          listing: toFavoriteListing(PRODUCT),
          category: "Laptops",
          note: "n",
          savedAt: 100,
        },
      ],
    };
    saveFavorites(state);
    expect(loadFavorites()).toEqual(state);
    expect(emptyFavorites()).toEqual({ categories: [], items: [] });
  });

  it("rejects corrupt payloads and normalizes categories", () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "not-json{{");
    expect(loadFavorites()).toEqual(emptyFavorites());
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ categories: [" A ", "a", "", 42, "B"], items: [{ id: "x" }] }),
    );
    const loaded = loadFavorites();
    expect(loaded.categories).toEqual(["A", "B"]);
    expect(loaded.items).toEqual([]);
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ categories: "nope", items: [] }),
    );
    expect(loadFavorites()).toEqual(emptyFavorites());
  });

  it("formats saved-at across minute/hour/day/week/date branches", () => {
    const now = Date.now();
    expect(formatSavedAt(now, "en", "just now")).toBe("just now");
    expect(formatSavedAt(now - 5 * 60_000, "en", "just now")).toMatch(/minute/);
    expect(formatSavedAt(now - 3 * 3_600_000, "en", "just now")).toMatch(/hour/);
    expect(formatSavedAt(now - 3 * 86_400_000, "en", "just now")).toMatch(/day/);
    expect(formatSavedAt(now - 14 * 86_400_000, "en", "just now")).toMatch(/week/);
    expect(formatSavedAt(now - 60 * 86_400_000, "de", "jetzt")).toMatch(/20/);
  });

  it("maps a raw product to a favorite listing, dropping raw and zip", () => {
    expect(toFavoriteListing(PRODUCT)).toEqual({
      id: "p1",
      marketplace: "tutti",
      title: "MacBook",
      priceChf: 900,
      currency: "CHF",
      condition: "used",
      imageUrl: "https://img",
      url: "https://tutti.ch/p1",
      bidPriceChf: null,
      listedPriceChf: null,
      location: "Bern",
    });
  });
});
