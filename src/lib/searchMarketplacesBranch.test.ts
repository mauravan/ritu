import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchRicardo } from "./marketplaces/ricardo";
import { searchTutti } from "./marketplaces/tutti";
import {
  augmentSearchQueries,
  buildMarketplaceQueries,
  searchMarketplaces,
} from "./searchMarketplaces";
import type { DerivedSpec, RawProduct } from "./types";

vi.mock("./marketplaces/ricardo", () => ({
  buildRicardoUrl: (q: string) => `https://www.ricardo.ch/de/s/${encodeURIComponent(q)}/`,
  searchRicardo: vi.fn(),
}));
vi.mock("./marketplaces/tutti", () => ({
  buildTuttiUrl: (q: string) => `https://www.tutti.ch/de/q/${encodeURIComponent(q)}`,
  searchTutti: vi.fn(),
}));

function mkSpec(requirements: DerivedSpec["requirements"]): DerivedSpec {
  return {
    category: "laptop",
    summary: "need",
    requirements,
    searchQueries: ["laptop"],
    excludedTerms: [],
  };
}

function mkRaw(id: string, marketplace: "ricardo" | "tutti", title = `Title ${id}`): RawProduct {
  return {
    id,
    marketplace,
    title,
    priceChf: 100,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://x/${id}`,
    location: null,
    raw: {},
  };
}

describe("searchMarketplaces extended", () => {
  beforeEach(() => {
    vi.mocked(searchRicardo).mockReset().mockResolvedValue([]);
    vi.mocked(searchTutti).mockReset().mockResolvedValue([]);
  });

  it("buildMarketplaceQueries fans out per platform", () => {
    expect(buildMarketplaceQueries(["mini pc"], "ricardo").map((q) => q.marketplace)).toEqual([
      "ricardo",
    ]);
    expect(buildMarketplaceQueries(["mini pc"], "tutti").map((q) => q.marketplace)).toEqual([
      "tutti",
    ]);
    const both = buildMarketplaceQueries(["mini pc"], "both");
    expect(both.map((q) => q.marketplace).sort()).toEqual(["ricardo", "tutti"]);
    expect(both[0]?.url).toContain("mini%20pc");
  });

  it("augmentSearchQueries appends non-numeric keyword requirements", () => {
    const spec = mkSpec([{ key: "brand", value: "Lenovo", importance: "required" }]);
    expect(augmentSearchQueries(["laptop"], spec)).toEqual(["laptop Lenovo"]);
  });

  it("augmentSearchQueries expands compound options into variants", () => {
    const spec = mkSpec([{ key: "cpu", value: "Intel i5 or AMD Ryzen 5", importance: "required" }]);
    const out = augmentSearchQueries(["laptop"], spec);
    expect(out).toContain("laptop");
    expect(out.some((q) => q.includes("Intel i5"))).toBe(true);
    expect(out.some((q) => q.includes("AMD Ryzen 5"))).toBe(true);
  });

  it("searchMarketplaces queries only ricardo for ricardo platform", async () => {
    vi.mocked(searchRicardo).mockResolvedValue([mkRaw("r1", "ricardo")]);
    const out = await searchMarketplaces(["laptop"], "ricardo", 5);
    expect(searchRicardo).toHaveBeenCalledWith("laptop", 5);
    expect(searchTutti).not.toHaveBeenCalled();
    expect(out.map((p) => p.id)).toEqual(["r1"]);
  });

  it("searchMarketplaces queries only tutti for tutti platform", async () => {
    vi.mocked(searchTutti).mockResolvedValue([mkRaw("t1", "tutti")]);
    const out = await searchMarketplaces(["laptop"], "tutti", 5);
    expect(searchTutti).toHaveBeenCalledWith("laptop", 5);
    expect(searchRicardo).not.toHaveBeenCalled();
    expect(out.map((p) => p.id)).toEqual(["t1"]);
  });

  it("searchMarketplaces slices queries to 3 and survives one-side rejection", async () => {
    vi.mocked(searchRicardo).mockRejectedValue(new Error("down"));
    vi.mocked(searchTutti).mockResolvedValue([mkRaw("t1", "tutti", "Unique Tutti Title")]);
    const out = await searchMarketplaces(["a", "b", "c", "d", "e"], "both", 5);
    expect(vi.mocked(searchTutti).mock.calls.length).toBe(3);
    expect(out.map((p) => p.id)).toEqual(["t1"]);
  });

  it("searchMarketplaces merges both sides and dedups", async () => {
    vi.mocked(searchRicardo).mockResolvedValue([mkRaw("r1", "ricardo", "Same Title")]);
    vi.mocked(searchTutti).mockResolvedValue([mkRaw("t1", "tutti", "Same Title")]);
    const out = await searchMarketplaces(["laptop"], "both", 5);
    expect(out.length).toBe(1);
  });
});
