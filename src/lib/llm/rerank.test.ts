import { generateObject } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DerivedSpec, RawProduct } from "../types";
import { logger } from "../logger";
import { getRerankConfig, rerankWithLLM } from "./rerank";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => `mock-openai:${model}`),
}));

const spec: DerivedSpec = {
  category: "laptop",
  summary: "User needs a laptop",
  requirements: [{ key: "cpu", value: "i7", importance: "required" }],
  searchQueries: ["laptop i7"],
  excludedTerms: ["sleeve"],
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

describe("rerank", () => {
  describe("getRerankConfig", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("returns null when LLM_API_KEY is not set", () => {
      vi.stubEnv("LLM_API_KEY", undefined);
      expect(getRerankConfig()).toBeNull();
    });

    it("returns null when LLM_API_KEY is empty", () => {
      vi.stubEnv("LLM_API_KEY", "");
      expect(getRerankConfig()).toBeNull();
    });

    it("returns config when LLM_API_KEY is set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_BASE_URL", "https://test.example.com");
      vi.stubEnv("LLM_MODEL", "test-model");
      const config = getRerankConfig();
      expect(config).not.toBeNull();
      expect(config?.apiKey).toBe("test-key");
      expect(config?.baseURL).toBe("https://test.example.com");
      expect(config?.model).toBe("test-model");
    });

    it("uses defaults when optional env vars not set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_BASE_URL", undefined);
      vi.stubEnv("LLM_MODEL", undefined);
      vi.stubEnv("LLM_RERANK_BASE_URL", undefined);
      vi.stubEnv("LLM_RERANK_MODEL", undefined);
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", undefined);
      vi.stubEnv("LLM_RERANK_MAX_BATCH", undefined);
      const config = getRerankConfig();
      expect(config).not.toBeNull();
      expect(config?.baseURL).toBe("https://openrouter.ai/api/v1");
      expect(config?.model).toBe("openai/gpt-4o-mini");
      expect(config?.timeoutMs).toBe(15000);
      expect(config?.maxBatch).toBe(40);
    });

    it("uses rerank-specific env vars when set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_BASE_URL", "https://rerank.example.com");
      vi.stubEnv("LLM_RERANK_MODEL", "rerank-model");
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", "30000");
      vi.stubEnv("LLM_RERANK_MAX_BATCH", "20");
      const config = getRerankConfig();
      expect(config).not.toBeNull();
      expect(config?.baseURL).toBe("https://rerank.example.com");
      expect(config?.model).toBe("rerank-model");
      expect(config?.timeoutMs).toBe(30000);
      expect(config?.maxBatch).toBe(20);
    });

    it("falls back to LLM_BASE_URL when LLM_RERANK_BASE_URL not set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_BASE_URL", "https://base.example.com");
      vi.stubEnv("LLM_RERANK_BASE_URL", undefined);
      const config = getRerankConfig();
      expect(config?.baseURL).toBe("https://base.example.com");
    });

    it("falls back to LLM_MODEL when LLM_RERANK_MODEL not set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_MODEL", "base-model");
      vi.stubEnv("LLM_RERANK_MODEL", undefined);
      const config = getRerankConfig();
      expect(config?.model).toBe("base-model");
    });

    it("falls back to default timeout when env is 0", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", "0");
      const config = getRerankConfig();
      expect(config?.timeoutMs).toBe(15000);
    });

    it("falls back to default maxBatch when env is 0", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_MAX_BATCH", "0");
      const config = getRerankConfig();
      expect(config?.maxBatch).toBe(40);
    });

    it("parses timeout from LLM_RERANK_TIMEOUT_MS", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", "25000");
      const config = getRerankConfig();
      expect(config?.timeoutMs).toBe(25000);
    });

    it("falls back to LLM_RERANK_TIMEOUT when LLM_RERANK_TIMEOUT_MS not set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_TIMEOUT", "20000");
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", undefined);
      const config = getRerankConfig();
      expect(config?.timeoutMs).toBe(20000);
    });

    it("parses maxBatch from LLM_RERANK_MAX_BATCH", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_RERANK_MAX_BATCH", "50");
      const config = getRerankConfig();
      expect(config?.maxBatch).toBe(50);
    });
  });

  describe("rerankWithLLM", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("LLM_API_KEY", "test-key");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    });

    it("returns empty map for empty products", async () => {
      const result = await rerankWithLLM([], spec);
      expect(result.size).toBe(0);
      expect(generateObject).not.toHaveBeenCalled();
    });

    it("returns empty map when no API key", async () => {
      vi.stubEnv("LLM_API_KEY", undefined);
      const result = await rerankWithLLM([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(generateObject).not.toHaveBeenCalled();
    });

    it("returns mapped results with clamped relevance", async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          results: [
            { id: "1", relevance: 95, relevant: true, reason: "great match" },
            { id: "2", relevance: 150, relevant: true, reason: "over max" },
            { id: "3", relevance: -10, relevant: false, reason: "under min" },
          ],
        },
      } as never);

      const result = await rerankWithLLM(
        [mkProduct("1", "laptop"), mkProduct("2", "laptop 2"), mkProduct("3", "sleeve")],
        spec,
      );

      expect(result.size).toBe(3);
      expect(result.get("1")).toMatchObject({ relevance: 95, relevant: true });
      expect(result.get("2")?.relevance).toBe(100);
      expect(result.get("3")?.relevance).toBe(0);
    });

    it("warns and returns empty map when LLM returns zero results", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.mocked(generateObject).mockResolvedValue({ object: { results: [] } } as never);
      const result = await rerankWithLLM([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("returned 0/1"));
      warn.mockRestore();
    });

    it("returns empty map on generic error", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.mocked(generateObject).mockRejectedValue(new Error("bad gateway"));
      const result = await rerankWithLLM([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("rerank failed"));
      warn.mockRestore();
    });

    it("returns empty map on timeout", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.stubEnv("LLM_RERANK_TIMEOUT_MS", "1000");
      vi.useFakeTimers();
      vi.mocked(generateObject).mockImplementation(() => new Promise(() => {}) as never);
      const promise = rerankWithLLM([mkProduct("1", "laptop")], spec);
      await vi.advanceTimersByTimeAsync(1500);
      const result = await promise;
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("timeout"));
      warn.mockRestore();
    });

    it("caps products to maxBatch", async () => {
      vi.stubEnv("LLM_RERANK_MAX_BATCH", "2");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          results: [
            { id: "1", relevance: 90, relevant: true, reason: "match" },
            { id: "2", relevance: 80, relevant: true, reason: "match" },
          ],
        },
      } as never);

      const products = [mkProduct("1", "a"), mkProduct("2", "b"), mkProduct("3", "c")];
      await rerankWithLLM(products, spec);

      const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string };
      expect(call.prompt).not.toContain('id="3"');
      expect(call.prompt).toContain('id="1"');
      expect(call.prompt).toContain('id="2"');
    });

    it("uses 'none' when spec has no requirements", async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          results: [{ id: "1", relevance: 90, relevant: true, reason: "match" }],
        },
      } as never);
      const noReqSpec: DerivedSpec = { ...spec, requirements: [] };
      await rerankWithLLM([mkProduct("1", "laptop")], noReqSpec);
      const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain("Requirements: none");
    });
    it("handles error without stack", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const err = Object.create(Error.prototype) as Error;
      vi.mocked(generateObject).mockRejectedValue(err);
      const result = await rerankWithLLM([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("stack="));
      warn.mockRestore();
    });

    it("handles non-Error rejection", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.mocked(generateObject).mockRejectedValue({ status: 500 });
      const result = await rerankWithLLM([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("rerank failed"));
      warn.mockRestore();
    });

    it("maps fulfillsRequired default true and false from LLM", async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          results: [
            { id: "1", relevance: 95, relevant: true, reason: "ok" },
            { id: "2", relevance: 5, relevant: false, reason: "fails", fulfillsRequired: false },
          ],
        },
      } as never);
      const result = await rerankWithLLM(
        [mkProduct("1", "laptop"), mkProduct("2", "laptop")],
        spec,
      );
      expect(result.get("1")?.fulfillsRequired).toBe(true);
      expect(result.get("2")?.fulfillsRequired).toBe(false);
    });
    it("marks wrong category with fulfillsRequired false", async () => {
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          results: [
            {
              id: "3",
              relevance: 5,
              relevant: false,
              reason: "wrong category",
              fulfillsRequired: false,
            },
          ],
        },
      } as never);
      const result = await rerankWithLLM([mkProduct("3", "DDR4 32GB RAM Module")], spec);
      expect(result.get("3")?.fulfillsRequired).toBe(false);
      expect(result.get("3")?.relevant).toBe(false);
    });
  });
});
