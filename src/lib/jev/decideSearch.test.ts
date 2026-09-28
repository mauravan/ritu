import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideSearchAction } from "./decideSearch";

function mockNoul(noul: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify({ answers: { search_now: { noul } } }), { status }),
    ),
  );
}

describe("decideSearchAction", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("JEV_MODEL", "typesafe/jev-1.13");
    vi.stubEnv("JEV_SEARCH_THRESHOLD", "0.5");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns search when noul is above threshold", async () => {
    mockNoul(0.9);
    await expect(decideSearchAction("MacBook Pro 14 M3 16GB 512GB")).resolves.toBe("search");
  });

  it("returns clarify when noul is below threshold", async () => {
    mockNoul(0.1);
    await expect(decideSearchAction("a nice computer")).resolves.toBe("clarify");
  });

  it("returns search without fetch when LLM_API_KEY is missing", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(decideSearchAction("anything")).resolves.toBe("search");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns search on non-2xx status", async () => {
    mockNoul(0.1, 429);
    await expect(decideSearchAction("query")).resolves.toBe("search");
  });

  it("returns search when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(decideSearchAction("query")).resolves.toBe("search");
  });

  it("sends the expected request body shape", async () => {
    mockNoul(0.9);
    await decideSearchAction("mini pc 16GB");
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      state: { query: string };
      questions: { search_now: { type: string; instructions: string; criteria: object } };
    };
    expect(body.model).toBe("typesafe/jev-1.13");
    expect(body.state.query).toBe("mini pc 16GB");
    expect(body.questions.search_now.type).toBe("noul");
    expect(body.questions.search_now.instructions).toContain("specific enough");
    expect(body.questions.search_now.criteria).toHaveProperty("true");
    expect(body.questions.search_now.criteria).toHaveProperty("false");
  });
});
