import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FavoriteItem, FavoritesState } from "@/lib/favorites";
import FavoritesPane from "./FavoritesPane";

function mkItem(id: string, category: string, savedAt: number): FavoriteItem {
  return {
    id,
    listing: {
      id: `l-${id}`,
      marketplace: "ricardo",
      title: `T-${id}`,
      priceChf: 500,
      currency: "CHF",
      condition: null,
      imageUrl: null,
      url: "https://x",
      bidPriceChf: null,
      listedPriceChf: null,
      location: null,
    },
    category,
    note: "",
    savedAt,
  };
}

const STATE: FavoritesState = {
  categories: ["Laptops", "Phones"],
  items: [mkItem("a", "Laptops", 100), mkItem("b", "Laptops", 200), mkItem("c", "Phones", 300)],
};

describe("FavoritesPane", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  function setup() {
    render(
      <FavoritesPane
        state={STATE}
        onAddCategory={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );
  }

  it("shows per-category counts and no header total", () => {
    setup();
    expect(screen.getByRole("button", { name: /Laptops \(2\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Phones \(1\)/ })).toBeTruthy();
    expect(screen.queryByText("3")).toBeNull();
  });

  it("pins the collapse button left and the title right", () => {
    setup();
    const collapse = screen.getByRole("button", { name: "collapse favorites" });
    const header = collapse.parentElement;
    expect(header?.firstElementChild).toBe(collapse);
    expect(header?.lastElementChild?.textContent).toBe("favorites");
  });

  it("keeps the add-category button last in the chip row", () => {
    setup();
    const add = screen.getByRole("button", { name: "+ new category" });
    const phones = screen.getByRole("button", { name: /Phones \(1\)/ });
    expect(phones.compareDocumentPosition(add)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(add.parentElement?.lastElementChild).toBe(add);
  });

  it("autofocuses the new-category input on open", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ new category" }));
    expect(screen.getByLabelText("Category name")).toBe(document.activeElement);
  });
  it("submits a new category, escapes the form, and collapses", () => {
    const onAddCategory = vi.fn();
    const onCollapse = vi.fn();
    render(
      <FavoritesPane
        state={STATE}
        onAddCategory={onAddCategory}
        onRemoveCategory={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onCollapse={onCollapse}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ new category" }));
    const input = screen.getByLabelText("Category name");
    fireEvent.change(input, { target: { value: "Tablets" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(onAddCategory).toHaveBeenCalledWith("Tablets");
    fireEvent.click(screen.getByRole("button", { name: "collapse favorites" }));
    expect(onCollapse).toHaveBeenCalled();
  });

  it("escapes the add form and confirms category deletion", () => {
    const onRemoveCategory = vi.fn();
    render(
      <FavoritesPane
        state={STATE}
        onAddCategory={vi.fn()}
        onRemoveCategory={onRemoveCategory}
        onRemoveItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ new category" }));
    fireEvent.keyDown(screen.getByLabelText("Category name"), { key: "Escape" });
    expect(screen.queryByLabelText("Category name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /delete category/ }));
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(onRemoveCategory).toHaveBeenCalledWith("Laptops");
  });

  it("renders empty states and the empty-category message", () => {
    const { unmount } = render(
      <FavoritesPane
        state={{ categories: [], items: [] }}
        onAddCategory={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText(/No favorites yet/)).toBeTruthy();
    unmount();
    render(
      <FavoritesPane
        state={{ categories: ["Laptops"], items: [] }}
        onAddCategory={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nothing saved in this category/)).toBeTruthy();
  });
});
