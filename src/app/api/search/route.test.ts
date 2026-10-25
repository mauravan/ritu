import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { searchMarketplaces } from "@/lib/searchMarketplaces";
import type { DerivedSpec, RawProduct } from "@/lib/types";
import { POST } from "./route";

vi.mock("@/lib/llm/deriveSpecs", () => ({ deriveSpecs: vi.fn() }));
vi.mock("@/lib/llm/rerank", () => ({ runOptionalRerank: vi.fn(async () => undefined) }));
vi.mock("@/lib/specScore/SpecScoreService", () => ({
  getSpecScoreService: vi.fn(() => ({
    score: vi.fn(async () => ({ scores: new Map(), source: "deterministic" })),
  })),
}));
vi.mock("@/lib/searchMarketplaces", async (importOriginal) => ({
  ...(await importOriginal()),
  searchMarketplaces: vi.fn(async () => [mkRaw("p1", "ricardo"), mkRaw("p2", "tutti")]),
}));

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "Compact desktop",
  requirements: [{ key: "ram", value: "16GB", importance: "required" }],
  searchQueries: ["mini pc"],
  excludedTerms: [],
};

function mkRaw(id: string, marketplace: "ricardo" | "tutti"): RawProduct {
  return {
    id,
    marketplace,
    title: `Mini PC 16GB ${id}`,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: "https://x",
    location: null,
    raw: {},
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("search route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deriveSpecs).mockResolvedValue({ ...SPEC });
    vi.mocked(searchMarketplaces).mockResolvedValue([mkRaw("p1", "ricardo"), mkRaw("p2", "tutti")]);
  });

  it("full search returns input, spec, queries and products", async () => {
    const res = await POST(post({ query: "mini pc", platform: "both" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      input: string;
      derivedSpec: DerivedSpec;
      queries: unknown[];
      products: unknown[];
      specScoringSource: string;
    };
    expect(json.input).toBe("mini pc");
    expect(json.derivedSpec.category).toBe("Mini PC");
    expect(json.queries.length).toBeGreaterThanOrEqual(1);
    expect(json.products.length).toBe(2);
    expect(json.specScoringSource).toBe("deterministic");
    expect(deriveSpecs).toHaveBeenCalledOnce();
    expect(deriveSpecs).toHaveBeenCalledWith("mini pc", "de");
  });

  it("always searches the original query", async () => {
    const res = await POST(post({ query: "mini pc 16GB" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { queries: { query: string }[] };
    expect(json.queries.map((q) => q.query)).toContain("mini pc 16GB");
  });

  it("validation error maps to 400 validation_error", async () => {
    vi.mocked(deriveSpecs).mockRejectedValue(new ValidationError("bad"));
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("spec derivation error maps to 502 spec_derivation_failed", async () => {
    vi.mocked(deriveSpecs).mockRejectedValue(new SpecDerivationError("boom"));
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("spec_derivation_failed");
  });

  it("invalid JSON maps to 400 invalid_json", async () => {
    const res = await POST(post("not json"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_json");
  });

  it("distance filter widens the marketplace cap", async () => {
    const res = await POST(
      post({ query: "mini pc", platform: "both", zipCode: "8000", radius: 10 }),
    );
    expect(res.status).toBe(200);
    const args = vi.mocked(searchMarketplaces).mock.calls[0];
    expect(args?.[2]).toBe(40);
  });
});
