import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const ricardoGet = vi.hoisted(() => vi.fn(async () => ({ description: "<p>Hello<br>world</p>" })));
const tuttiGet = vi.hoisted(() => vi.fn(async () => ({ body: "Body text" })));

vi.mock("ricardo-api", () => ({
  RicardoClient: class {
    listings = { get: ricardoGet };
  },
}));
vi.mock("tutti-api", () => ({
  TuttiClient: class {
    listings = { get: tuttiGet };
  },
}));
vi.mock("@/lib/marketplaces/rateLimit", async (importOriginal) => ({
  ...(await importOriginal()),
  withRicardoLimit: (fn: () => Promise<unknown>) => fn(),
  withTuttiLimit: (fn: () => Promise<unknown>) => fn(),
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/proxyFetch", () => ({ getProxyFetch: () => global.fetch }));

function get(query: string): Request {
  return new Request(`http://localhost/api/listing-description?${query}`);
}

describe("listing-description route contracts", () => {
  beforeEach(() => {
    ricardoGet.mockReset().mockResolvedValue({ description: "<p>Hello<br>world</p>" });
    tuttiGet.mockReset().mockResolvedValue({ body: "Body text" });
  });

  it("ricardo strips html tags", async () => {
    const res = await GET(get("marketplace=ricardo&id=1"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { description: string };
    expect(json.description).toBe("Hello\nworld");
  });

  it("tutti returns body text", async () => {
    const res = await GET(get("marketplace=tutti&id=2"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { description: string };
    expect(json.description).toBe("Body text");
  });

  it("unknown marketplace maps to 400 validation_error", async () => {
    const res = await GET(get("marketplace=ebay&id=1"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("missing id maps to 400", async () => {
    const res = await GET(get("marketplace=ricardo"));
    expect(res.status).toBe(400);
  });

  it("oversized id maps to 400", async () => {
    const res = await GET(get(`marketplace=ricardo&id=${"x".repeat(101)}`));
    expect(res.status).toBe(400);
  });

  it("client failure maps to 502 description_fetch_failed", async () => {
    ricardoGet.mockRejectedValueOnce(new Error("down"));
    const res = await GET(get("marketplace=ricardo&id=1"));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("description_fetch_failed");
  });
});
