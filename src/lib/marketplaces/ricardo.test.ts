import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRicardo, buildRicardoUrl } from "./ricardo";

const article = {
  id: "1200985678",
  title: "Intel NUC 16GB RAM Mini PC",
  buyNowPrice: 69,
  bidPrice: 50,
  image: "https://img.ricardostatic.ch/images/abc/t_265x200/myimage.jpg",
  conditionKey: "new",
  shipping: [{ city: "Zurich", zipCode: "8001" }],
};

const mockJson = { articles: [article] };

describe("ricardo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps article correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => mockJson,
      })) as unknown as typeof fetch,
    );

    const result = await searchRicardo("mini pc", null, 5);
    expect(result[0]!.priceChf).toBe(69);
    expect(result[0]!.condition).toBe("new");
    expect(result[0]!.url).toContain("1200985678");
    expect(result[0]!.marketplace).toBe("ricardo");
    expect(result[0]!.imageUrl).toContain("t_800x600");
  });

  it("sends Cookie header when auth provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => mockJson,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await searchRicardo("test", { cookies: "ricardo_session=abc" }, 5);
    const calledHeaders = ((fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(calledHeaders.Cookie).toContain("ricardo_session=abc");
  });

  it("buildRicardoUrl encodes query", () => {
    expect(buildRicardoUrl("mini pc")).toBe("https://www.ricardo.ch/de/s/mini%20pc/");
  });

  it("returns [] on non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch,
    );
    const result = await searchRicardo("test", null, 5);
    expect(result).toEqual([]);
  });
});
