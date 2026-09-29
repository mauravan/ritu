import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type en from "@/dictionaries/en.json";
import type { FavoriteListing } from "@/lib/favorites";
import FavoriteButton from "./FavoriteButton";

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

const DICT = {
  favorite_remove: "Remove from favorites",
  favorite_save: "Save to favorites",
  favorite_pick_category: "Save to category",
  favorite_category_input_label: "Category name",
  favorite_category_placeholder: "category name…",
} as unknown as typeof en;

function setup(props: { favoriteId: string | null; categories: string[] }) {
  const onAdd = (...args: unknown[]) => {
    (setup.calls as unknown[][]).push(args as unknown[]);
  };
  setup.calls = [] as unknown[][];
  const onRemove = (...args: unknown[]) => {
    (setup.removeCalls as unknown[][]).push(args as unknown[]);
  };
  setup.removeCalls = [] as unknown[][];
  render(
    <FavoriteButton
      listing={LISTING}
      favoriteId={props.favoriteId}
      categories={props.categories}
      onAdd={onAdd as never}
      onRemove={onRemove as never}
      dict={DICT}
    />,
  );
}
setup.calls = [] as unknown[][];
setup.removeCalls = [] as unknown[][];

describe("FavoriteButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("removes directly when already favorited", () => {
    setup({ favoriteId: "fav-1", categories: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remove from favorites" }));
    expect(setup.removeCalls).toEqual([["fav-1"]]);
  });

  it("opens the category picker, saves to a category, and escapes", () => {
    setup({ favoriteId: null, categories: ["Laptops"] });
    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
    const dialog = screen.getByRole("dialog", { name: "Save to category" });
    fireEvent.click(screen.getByRole("button", { name: "Laptops" }));
    expect(setup.calls).toEqual([[LISTING, "Laptops"]]);
    expect(dialog).toBeTruthy();
  });

  it("saves to a new category via the inline form", () => {
    setup({ favoriteId: null, categories: [] });
    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Tablets" } });
    fireEvent.submit(screen.getByLabelText("Category name").closest("form") as HTMLFormElement);
    expect(setup.calls).toEqual([[LISTING, "Tablets"]]);
  });
  it("closes on Escape refocusing the trigger and on outside click", () => {
    setup({ favoriteId: null, categories: ["Laptops"] });
    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
    const trigger = screen.getByRole("button", { name: "Save to favorites" });
    const dialog = screen.getByRole("dialog", { name: "Save to category" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Save to category" })).toBeNull();
  });
});
