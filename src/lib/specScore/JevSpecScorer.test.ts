import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DerivedSpec, RawProduct } from "../types";
import { JevSpecScorer } from "./JevSpecScorer";

function makeProduct(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: "p1",
    marketplace: "ricardo",
    title: "Mini PC 16GB",
    priceChf: 100,
    currency: "CHF",
    condition: "new",
    imageUrl: null,
    url: "https://x",
    location: null,
    raw: { desc: "16gb ram" },
    ...overrides,
  };
}

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "Compact desktop",
  requirements: [{ key: "ram", value: "16GB", importance: "required" }],
  searchQueries: ["mini pc"],
  excludedTerms: ["sleeve"],
};

function mockFulfills(noul: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ answers: { fulfills: { type: "noul", noul } } }), { status }),
    ),
  );
}

describe("JevSpecScorer", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("JEV_MODEL", "typesafe/jev-1.13");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns empty map for empty input without fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new JevSpecScorer().score([], SPEC)).resolves.toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps noul 0.87 to specScore 87", async () => {
    mockFulfills(0.87);
    const result = await new JevSpecScorer().score([makeProduct()], SPEC);
    expect(result.get("p1")?.specScore).toBe(87);
    expect(result.get("p1")?.matchedRequirements).toEqual([]);
    expect(result.get("p1")?.reasons).toEqual([]);
  });

  it("sends the expected request body shape", async () => {
    mockFulfills(0.9);
    await new JevSpecScorer().score(
      [makeProduct({ id: "p1", title: "Mini PC", condition: "new" })],
      SPEC,
    );
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      state: {
        requirements: { key: string; value: string; importance: string }[];
        excludedTerms: string[];
        listing: { title: string; condition: string | null; raw: string };
      };
      questions: { fulfills: { type: string } };
    };
    expect(body.model).toBe("typesafe/jev-1.13");
    expect(body.state.requirements).toEqual([
      { key: "ram", value: "16GB", importance: "required" },
    ]);
    expect(body.state.excludedTerms).toEqual(["sleeve"]);
    expect(body.state.listing.title).toBe("Mini PC");
    expect(body.questions.fulfills.type).toBe("noul");
  });

  it("omits price requirements from state and tells Jev to ignore price", async () => {
    mockFulfills(0.9);
    const specWithPrice: DerivedSpec = {
      ...SPEC,
      requirements: [
        { key: "ram", value: "16GB", importance: "required" },
        { key: "price", value: "under 500 CHF", importance: "required" },
      ],
    };
    await new JevSpecScorer().score([makeProduct({ id: "p1" })], specWithPrice);
    const fetchMock = vi.mocked(globalThis.fetch);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init?.body)) as {
      state: { requirements: { key: string; value: string; importance: string }[] };
      questions: { fulfills: { instructions: string } };
    };
    expect(body.state.requirements).toEqual([
      { key: "ram", value: "16GB", importance: "required" },
    ]);
    expect(body.questions.fulfills.instructions).toContain(
      "Ignore any price or budget requirement",
    );
  });

  it("omits budget requirements from state", async () => {
    mockFulfills(0.9);
    const specWithBudget: DerivedSpec = {
      ...SPEC,
      requirements: [
        { key: "ram", value: "16GB", importance: "required" },
        { key: "budget", value: "under 500 CHF", importance: "required" },
      ],
    };
    await new JevSpecScorer().score([makeProduct({ id: "p1" })], specWithBudget);
    const fetchMock = vi.mocked(globalThis.fetch);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init?.body)) as {
      state: { requirements: { key: string; value: string; importance: string }[] };
    };
    expect(body.state.requirements).toEqual([
      { key: "ram", value: "16GB", importance: "required" },
    ]);
  });

  it("throws on non-2xx status", async () => {
    mockFulfills(0.9, 429);
    await expect(new JevSpecScorer().score([makeProduct()], SPEC)).rejects.toThrow();
  });

  it("throws on missing noul", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ answers: {} }), { status: 200 })),
    );
    await expect(new JevSpecScorer().score([makeProduct()], SPEC)).rejects.toThrow();
  });

  it("throws on out-of-range noul", async () => {
    mockFulfills(1.5);
    await expect(new JevSpecScorer().score([makeProduct()], SPEC)).rejects.toThrow();
  });

  it("throws when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(new JevSpecScorer().score([makeProduct()], SPEC)).rejects.toThrow();
  });

  it("throws when LLM_API_KEY is missing", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new JevSpecScorer().score([makeProduct()], SPEC)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
