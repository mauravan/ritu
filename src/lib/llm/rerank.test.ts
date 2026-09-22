import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger";
import type { DerivedSpec, RawProduct } from "../types";
import { getRerankConfig, rerankWithModel } from "./rerank";

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

function mockRerankOk(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    }),
  );
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
      vi.stubEnv("LLM_RERANK_MODEL", "test-rerank-model");
      const config = getRerankConfig();
      expect(config).not.toBeNull();
      expect(config?.apiKey).toBe("test-key");
      expect(config?.baseURL).toBe("https://test.example.com");
      expect(config?.model).toBe("test-rerank-model");
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
      expect(config?.model).toBe("voyageai/rerank-2.5");
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

    it("defaults to voyageai/rerank-2.5 when LLM_RERANK_MODEL not set", () => {
      vi.stubEnv("LLM_API_KEY", "test-key");
      vi.stubEnv("LLM_MODEL", "some-chat-model");
      vi.stubEnv("LLM_RERANK_MODEL", undefined);
      const config = getRerankConfig();
      expect(config?.model).toBe("voyageai/rerank-2.5");
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

  describe("rerankWithModel", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("LLM_API_KEY", "test-key");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("returns empty map for empty products", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const result = await rerankWithModel([], spec);
      expect(result.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns empty map when no API key", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      vi.stubEnv("LLM_API_KEY", undefined);
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns mapped results with clamped relevance", async () => {
      mockRerankOk({
        results: [
          { index: 0, relevance_score: 0.95 },
          { index: 1, relevance_score: 1.5 },
          { index: 2, relevance_score: -0.1 },
        ],
      });

      const result = await rerankWithModel(
        [mkProduct("1", "laptop"), mkProduct("2", "laptop 2"), mkProduct("3", "sleeve")],
        spec,
      );

      expect(result.size).toBe(3);
      expect(result.get("1")).toMatchObject({ id: "1", relevance: 95 });
      expect(result.get("2")?.relevance).toBe(100);
      expect(result.get("3")?.relevance).toBe(0);
    });

    it("warns and returns empty map when reranker returns zero results", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      mockRerankOk({ results: [] });
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("returned 0/1"));
      warn.mockRestore();
    });

    it("returns empty map on HTTP error", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          text: async () => "bad gateway",
        }),
      );
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("rerank failed"));
      warn.mockRestore();
    });

    it("returns empty map on timeout", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" })),
      );
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("timeout"));
      warn.mockRestore();
    });

    it("caps products to maxBatch", async () => {
      vi.stubEnv("LLM_RERANK_MAX_BATCH", "2");
      mockRerankOk({
        results: [
          { index: 0, relevance_score: 0.9 },
          { index: 1, relevance_score: 0.8 },
        ],
      });

      const products = [mkProduct("1", "a"), mkProduct("2", "b"), mkProduct("3", "c")];
      await rerankWithModel(products, spec);

      const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(opts.body) as { documents: string[]; top_n: number };
      expect(body.documents).toHaveLength(2);
      expect(body.top_n).toBe(2);
    });

    it("builds query with requirements", async () => {
      mockRerankOk({ results: [{ index: 0, relevance_score: 0.9 }] });
      await rerankWithModel([mkProduct("1", "laptop")], spec);
      const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(opts.body) as { query: string };
      expect(body.query).toContain("Requirements: cpu: i7 (required)");
    });

    it("includes excludedTerms in the rerank query", async () => {
      mockRerankOk({ results: [{ index: 0, relevance_score: 0.9 }] });
      await rerankWithModel([mkProduct("1", "laptop")], spec);
      const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(opts.body) as { query: string };
      expect(body.query).toContain("Excluded terms");
      expect(body.query).toContain("sleeve");
    });

    it("omits requirements section when spec has no requirements", async () => {
      mockRerankOk({ results: [{ index: 0, relevance_score: 0.9 }] });
      const noReqSpec: DerivedSpec = { ...spec, requirements: [] };
      await rerankWithModel([mkProduct("1", "laptop")], noReqSpec);
      const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(opts.body) as { query: string };
      expect(body.query).not.toContain("Requirements:");
    });

    it("handles error without stack", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const err = Object.create(Error.prototype) as Error;
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("stack="));
      warn.mockRestore();
    });

    it("handles non-Error rejection", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue({ status: 500 }));
      const result = await rerankWithModel([mkProduct("1", "laptop")], spec);
      expect(result.size).toBe(0);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("rerank failed"));
      warn.mockRestore();
    });
  });
});
