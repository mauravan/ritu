import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/dictionaries/en.json";
import type { FavoriteListing } from "@/lib/favorites";
import FavoriteCard from "./FavoriteCard";

const LISTING: FavoriteListing = {
  id: "l1",
  marketplace: "ricardo",
  title: "ThinkPad T14",
  priceChf: 500,
  currency: "CHF",
  condition: null,
  imageUrl: null,
  url: "https://x",
  bidPriceChf: null,
  listedPriceChf: null,
  location: null,
};

describe("FavoriteCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ricardo bid+listed price text", () => {
    render(
      <FavoriteCard
        item={{
          id: "a",
          listing: { ...LISTING, bidPriceChf: 100, listedPriceChf: 150 },
          category: "Laptops",
          note: "",
          savedAt: Date.now(),
        }}
        onRemove={() => {}}
        onUpdateNote={() => {}}
        dict={en}
        locale="en"
      />,
    );
    expect(screen.getByText(/CHF 100/)).toBeTruthy();
    expect(screen.getByText(/CHF 150/)).toBeTruthy();
  });

  it("renders price-unavailable fallback and note add/edit flow", () => {
    const { rerender } = render(
      <FavoriteCard
        item={{
          id: "a",
          listing: { ...LISTING, priceChf: null },
          category: "Laptops",
          note: "",
          savedAt: Date.now(),
        }}
        onRemove={() => {}}
        onUpdateNote={() => {}}
        dict={en}
        locale="en"
      />,
    );
    expect(screen.getByText(String(en.price_unavailable))).toBeTruthy();
    expect(screen.getByRole("button", { name: String(en.favorite_add_note) })).toBeTruthy();
    rerender(
      <FavoriteCard
        item={{
          id: "a",
          listing: LISTING,
          category: "Laptops",
          note: "nice one",
          savedAt: Date.now(),
        }}
        onRemove={() => {}}
        onUpdateNote={() => {}}
        dict={en}
        locale="en"
      />,
    );
    expect(screen.getByRole("button", { name: "nice one" })).toBeTruthy();
  });
  it("commits a note on Enter and removes the item", () => {
    const updates: Array<[string, string]> = [];
    const removed: string[] = [];
    render(
      <FavoriteCard
        item={{ id: "a", listing: LISTING, category: "Laptops", note: "", savedAt: Date.now() }}
        onRemove={(id) => removed.push(id)}
        onUpdateNote={(id, note) => updates.push([id, note])}
        dict={en}
        locale="en"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: String(en.favorite_add_note) }));
    const input = screen.getByLabelText(String(en.favorite_note_label));
    fireEvent.change(input, { target: { value: "keep box" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(updates).toEqual([["a", "keep box"]]);
    fireEvent.click(screen.getByRole("button", { name: String(en.favorite_remove) }));
    expect(removed).toEqual(["a"]);
  });
});
