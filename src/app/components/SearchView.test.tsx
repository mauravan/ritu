import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DerivedSpec, MarketplaceQuery, RankedProduct, SearchResult } from "@/lib/types";
import SearchView from "./SearchView";

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "Compact desktop",
  requirements: [{ key: "ram", value: "16GB", importance: "required" }],
  searchQueries: ["mini pc"],
  excludedTerms: [],
};

function mkProduct(id: string, title: string, marketplace: "ricardo" | "tutti"): RankedProduct {
  return {
    id,
    marketplace,
    title,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://${marketplace}.ch/${id}`,
    location: null,
    raw: {},
    specScore: 80,
    valueScore: 70,
    tags: [],
    matchedRequirements: ["ram: 16GB"],
    reasons: ["Matches: ram: 16GB"],
    hybridScore: 75,
  };
}

const QUERIES: MarketplaceQuery[] = [
  { marketplace: "ricardo", query: "mini pc", url: "https://ricardo" },
  { marketplace: "tutti", query: "mini pc", url: "https://tutti" },
];

const RESULT: SearchResult = {
  input: "mini pc",
  derivedSpec: SPEC,
  queries: QUERIES,
  products: [mkProduct("p1", "Mini PC Alpha", "ricardo"), mkProduct("p2", "Mini PC Beta", "tutti")],
};

describe("SearchView", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  function stubFetch(searchStatus: number, searchBody: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ derivedSpec: SPEC }), { status: 200 });
        }
        return new Response(JSON.stringify(searchBody), { status: searchStatus });
      }),
    );
  }

  it("renders results after search", async () => {
    stubFetch(200, RESULT);
    render(<SearchView />);
    fireEvent.change(screen.getByRole("textbox", { name: /what are you looking for/i }), {
      target: { value: "mini pc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search$/i }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Mini PC Alpha/ })).toBeDefined());
    expect(screen.getByRole("link", { name: /Mini PC Beta/ })).toBeDefined();
    expect(screen.getByText("Compact desktop")).toBeDefined();
    expect(screen.getAllByText("mini pc").length).toBeGreaterThanOrEqual(1);
  });

  it("shows composed error message on failure", async () => {
    stubFetch(502, { error: "spec_derivation_failed", details: "boom" });
    render(<SearchView />);
    fireEvent.change(screen.getByRole("textbox", { name: /what are you looking for/i }), {
      target: { value: "mini pc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search$/i }));
    await waitFor(() => expect(screen.getByText("spec_derivation_failed: boom")).toBeDefined());
  });
});

describe("SearchView branches", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function search() {
    fireEvent.change(screen.getByRole("textbox", { name: /what are you looking for/i }), {
      target: { value: "mini pc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search$/i }));
  }

  it("proceeds to full search when derive fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
        }
        return new Response(JSON.stringify(RESULT), { status: 200 });
      }),
    );
    render(<SearchView />);
    await search();
    await waitFor(() => expect(screen.getByRole("link", { name: /Mini PC Alpha/ })).toBeDefined());
  });

  it("shows no-products message for empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ derivedSpec: SPEC }), { status: 200 });
        }
        return new Response(JSON.stringify({ ...RESULT, products: [] }), { status: 200 });
      }),
    );
    render(<SearchView />);
    await search();
    await waitFor(() =>
      expect(screen.getAllByText(/No products found/).length).toBeGreaterThanOrEqual(1),
    );
  });

  it("falls back to status message when error has no code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ derivedSpec: SPEC }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 500 });
      }),
    );
    render(<SearchView />);
    await search();
    await waitFor(() => expect(screen.getByText("Search failed: 500")).toBeDefined());
  });

  it("shows fetch exception as error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(<SearchView />);
    await search();
    await waitFor(() => expect(screen.getByText(/network down/)).toBeDefined());
  });

  it("returns clarifying question on askQuestion path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ derivedSpec: SPEC }), { status: 200 });
        }
        if (JSON.parse(String(init?.body ?? "{}")).askQuestion === true) {
          return new Response(JSON.stringify({ clarifyingQuestion: "What size?" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify(RESULT), { status: 200 });
      }),
    );
    render(<SearchView />);
    fireEvent.change(screen.getByRole("textbox", { name: /what are you looking for/i }), {
      target: { value: "mini pc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search with question/i }));
    await waitFor(() => expect(screen.getByText("What size?")).toBeDefined());
  });

  it("shows error on askQuestion failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const s = String(input instanceof Request ? input.url : input);
        if (s.includes("/api/search/derive")) {
          return new Response(JSON.stringify({ derivedSpec: SPEC }), { status: 200 });
        }
        if (JSON.parse(String(init?.body ?? "{}")).askQuestion === true) {
          return new Response(JSON.stringify({ error: "spec_derivation_failed" }), {
            status: 502,
          });
        }
        return new Response(JSON.stringify(RESULT), { status: 200 });
      }),
    );
    render(<SearchView />);
    fireEvent.change(screen.getByRole("textbox", { name: /what are you looking for/i }), {
      target: { value: "mini pc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search with question/i }));
    await waitFor(() => expect(screen.getByText(/spec_derivation_failed/)).toBeDefined());
  });
});
