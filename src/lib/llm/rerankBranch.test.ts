import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DerivedSpec, RawProduct } from "../types";
import { runOptionalRerank } from "./rerank";

const spec: DerivedSpec = {
  category: "laptop",
  summary: "User needs a laptop",
  requirements: [{ key: "cpu", value: "i7", importance: "required" }],
  searchQueries: ["laptop i7"],
  excludedTerms: [],
};

function mkProduct(id: string, title: string): RawProduct {
  return {
    id,
    marketplace: "ricardo",
    title,
    priceChf: 500,
    currency: "CHF",
    condition: null,
    imageUrl: null,
    url: `https://example.com/${id}`,
    location: null,
    raw: {},
  };
}

describe("rerank branch extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LLM_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("runOptionalRerank returns undefined without key", async () => {
    vi.stubEnv("LLM_API_KEY", undefined);
    await expect(runOptionalRerank([mkProduct("1", "laptop")], spec)).resolves.toBeUndefined();
  });

  it("runOptionalRerank returns map on success", async () => {
    vi.stubEnv("LLM_RERANK_MAX_BATCH", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ index: 0, relevance_score: 0.9 }] }),
      }),
    );
    const out = await runOptionalRerank([mkProduct("1", "laptop"), mkProduct("2", "laptop")], spec);
    expect(out?.size).toBe(1);
  });

  it("runOptionalRerank returns empty map when inner throws non-Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("plain string error"));
    const out = await runOptionalRerank([mkProduct("1", "laptop")], spec);
    expect(out?.size ?? 0).toBe(0);
  });
});
