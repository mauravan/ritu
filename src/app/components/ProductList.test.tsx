import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RankedProduct } from "@/lib/types";
import ProductList from "./ProductList";

vi.mock("./useLocale", () => ({
  default: () => ["en" as const, () => {}],
}));

afterEach(() => cleanup());

function mkRanked(
  overrides: Partial<RankedProduct> & { id: string; title: string },
): RankedProduct {
  return {
    marketplace: "ricardo",
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://ricardo.ch/${overrides.id}`,
    location: null,
    raw: {},
    specScore: 60,
    valueScore: 50,
    tags: [],
    matchedRequirements: [],
    reasons: [],
    ...overrides,
  } as RankedProduct;
}
function renderList(products: RankedProduct[]) {
  return renderToString(
    <ProductList
      products={products}
      sortBy="hybrid"
      sortDir="desc"
      onSortChange={() => undefined}
      specScoringSource="deterministic"
    />,
  );
}

describe("ProductList", () => {
  it("renders hybrid and AI relevance bars", () => {
    const p = mkRanked({
      id: "1",
      title: "Lenovo ThinkPad T14",
      specScore: 70,
      valueScore: 60,
      relevance: 95,
      hybridScore: 82,
      tags: ["best specs"],
    });
    const html = renderList([p]);
    expect(html).toContain("AI relevance");
    expect(html).toContain("Hybrid");
    expect(html).toContain("best specs");
  });

  it("renders original description disclosure", () => {
    const p = mkRanked({ id: "raw-test", title: "Raw listing" });
    const html = renderList([p]);
    expect(html).toContain("Original description");
  });

  it("deterministic product has no hybrid or AI bar", () => {
    const p = mkRanked({
      id: "2",
      title: "Mini PC 16GB",
      specScore: 40,
      valueScore: 30,
    });
    const html = renderList([p]);
    expect(html).not.toContain("Hybrid score");
    expect(html).not.toContain("AI relevance");
  });

  it("renders empty state message", () => {
    const html = renderList([]);
    expect(html).toContain("No products found");
  });
  it("renders image error fallback", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      imageUrl: "https://example.com/image.jpg",
    });
    const html = renderList([p]);
    expect(html).toContain("No image");
    // onError handler not rendered in SSR
  });

  it("renders matched requirements and reasons", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      matchedRequirements: ["cpu: i7", "ram: 16gb"],
      reasons: ["Matches: cpu: i7, ram: 16gb"],
    });
    const html = renderList([p]);
    expect(html).toContain("cpu: i7");
    expect(html).toContain("ram: 16gb");
    expect(html).toContain("Matches:");
  });

  it("renders tags with colors", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      tags: ["best value", "cheapest", "best specs"],
    });
    const html = renderList([p]);
    expect(html).toContain("best value");
    expect(html).toContain("cheapest");
    expect(html).toContain("best specs");
  });

  it("renders condition and location", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      condition: "new",
      location: "Zurich",
    });
    const html = renderList([p]);
    expect(html).toContain("new");
    expect(html).toContain("Zurich");
  });

  it("renders ricardo bid/listed prices", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      marketplace: "ricardo",
      bidPriceChf: 50,
      listedPriceChf: 100,
    });
    const html = renderList([p]);
    expect(html).toContain("CHF 50 bid");
    expect(html).toContain("CHF 100 listed");
  });

  it("renders price unavailable when null", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      priceChf: null,
    });
    const html = renderList([p]);
    expect(html).toContain("Price unavailable");
  });

  it("translates condition reasons", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      reasons: ["Condition: new"],
    });
    const html = renderList([p]);
    expect(html).toContain("Condition:");
  });

  it("translates penalty reasons", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      reasons: ['Penalty: excluded term "sleeve"', "Penalty: numeric mismatch (ram: 32gb)"],
    });
    const html = renderList([p]);
    expect(html).toContain("Penalty: excluded term");
    expect(html).toContain("Penalty: numeric mismatch");
    expect(html).toContain("(ram: 32gb)");
  });

  it("renders untranslated reasons as-is", () => {
    const p = mkRanked({
      id: "1",
      title: "Test Product",
      reasons: ["Matches: cpu: i7", "Custom note xyz"],
    });
    const html = renderList([p]);
    expect(html).toContain("Matches:");
    expect(html).toContain("Custom note xyz");
  });

  it("renders ricardo bid-only and listed-only prices", () => {
    const bidOnly = renderList([
      mkRanked({
        id: "b",
        title: "Bid",
        marketplace: "ricardo",
        bidPriceChf: 30,
        listedPriceChf: null,
      }),
    ]);
    expect(bidOnly).toContain("CHF 30 bid");
    expect(bidOnly).not.toContain("listed");
    const listedOnly = renderList([
      mkRanked({
        id: "l",
        title: "Listed",
        marketplace: "ricardo",
        bidPriceChf: null,
        listedPriceChf: 80,
      }),
    ]);
    expect(listedOnly).toContain("CHF 80 listed");
    expect(listedOnly).not.toContain("bid");
  });

  it("renders nothing extra for empty requirements and reasons", () => {
    const p = mkRanked({ id: "1", title: "Lens" });
    const html = renderList([p]);
    expect(html).toContain("Lens");
    expect(html).not.toContain("cpu: i7");
  });

  it("renders all products when > 40 products", () => {
    const products = Array.from({ length: 45 }, (_, i) =>
      mkRanked({ id: String(i), title: `Product ${i}` }),
    );
    const html = renderList(products);
    expect(html).toContain("Product 44");
    expect(html).toContain("45");
  });

  it("renders ranked products count", () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      mkRanked({ id: String(i), title: `Product ${i}` }),
    );
    const html = renderList(products);
    expect(html).toContain("Ranked Products");
  });

  it("renders AI spec tooltip when jev source", () => {
    window.localStorage.setItem("locale", "en");
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 40,
      top: 100,
      bottom: 120,
      height: 20,
      right: 140,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as unknown as DOMRect);
    const products = [mkRanked({ id: "p1", title: "Mini PC" })];
    render(
      <ProductList
        products={products}
        sortBy="hybrid"
        sortDir="desc"
        onSortChange={() => undefined}
        specScoringSource="jev"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Spec score" }));
    expect(screen.getByRole("dialog").textContent).toContain("Jev model");
  });
});
