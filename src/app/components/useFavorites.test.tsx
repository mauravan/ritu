import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { FavoriteListing, FavoritesState } from "@/lib/favorites";
import useFavorites, { favoriteListingKey } from "./useFavorites";

const LISTING: FavoriteListing = {
  id: "l1",
  marketplace: "ricardo",
  title: "ThinkPad",
  priceChf: 500,
  currency: "CHF",
  condition: null,
  imageUrl: null,
  url: "https://x",
  bidPriceChf: null,
  listedPriceChf: null,
  location: null,
};
type Api = {
  state: FavoritesState;
  categories: string[];
  lookup: Map<string, string>;
  count: number;
  addItem: (listing: FavoriteListing, category: string) => void;
  removeItem: (favoriteId: string) => void;
  updateNote: (favoriteId: string, note: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
};

function Probe({ onReady }: { onReady: (api: Api) => void }) {
  const api = useFavorites();
  onReady(api);
  return <span data-testid="count">{api.count}</span>;
}

function setup() {
  let api: Api | null = null;
  render(<Probe onReady={(a) => (api = a)} />);
  return () => api as Api;
}

describe("useFavorites", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("adds items idempotently, tracks lookup, and removes", () => {
    const get = setup();
    act(() => {
      get().addCategory("Laptops");
      get().addCategory("laptops");
    });
    act(() => {
      get().addItem(LISTING, "Laptops");
      get().addItem(LISTING, "Laptops");
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    const key = favoriteListingKey("ricardo", "l1");
    expect(get().lookup.get(key)).toBeTruthy();
    const id = get().lookup.get(key) as string;
    act(() => {
      get().updateNote(id, "hello");
    });
    expect(get().state.items[0].note).toBe("hello");
    act(() => {
      get().removeItem(id);
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(window.localStorage.getItem("ritu:favorites:v1")).toContain("Laptops");
    act(() => {
      get().removeCategory("Laptops");
    });
    expect(get().categories).toEqual([]);
  });
});
