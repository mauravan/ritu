import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const ricardoGet = vi.hoisted(() =>
  vi.fn(async () => ({
    images: [
      {
        index: 0,
        transformations: [
          { name: "t_1000x750", url: "https://img.ricardostatic.ch/small.jpg" },
          { name: "t_1800x1350", url: "https://img.ricardostatic.ch/big.jpg" },
        ],
      },
    ],
  })),
);
const tuttiGet = vi.hoisted(() =>
  vi.fn(async () => ({ images: [{ rendition: { src: "https://c.tutti.ch/big/a.jpg" } }] })),
);

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
  return new Request(`http://localhost/api/listing-images?${query}`);
}

describe("listing-images route contracts", () => {
  beforeEach(() => {
    ricardoGet.mockReset().mockResolvedValue({
      images: [
        {
          index: 0,
          transformations: [
            { name: "t_1000x750", url: "https://img.ricardostatic.ch/small.jpg" },
            { name: "t_1800x1350", url: "https://img.ricardostatic.ch/big.jpg" },
          ],
        },
      ],
    });
    tuttiGet.mockReset().mockResolvedValue({
      images: [{ rendition: { src: "https://c.tutti.ch/big/a.jpg" } }],
    });
  });

  it("ricardo success returns image array", async () => {
    const res = await GET(get("marketplace=ricardo&id=1"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { images: string[] };
    expect(json.images).toEqual(["https://img.ricardostatic.ch/big.jpg"]);
  });

  it("tutti success returns image array", async () => {
    const res = await GET(get("marketplace=tutti&id=2"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { images: string[] };
    expect(json.images).toEqual(["https://c.tutti.ch/big/a.jpg"]);
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

  it("client failure maps to 502 images_fetch_failed", async () => {
    ricardoGet.mockRejectedValueOnce(new Error("down"));
    const res = await GET(get("marketplace=ricardo&id=1"));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("images_fetch_failed");
  });
});
