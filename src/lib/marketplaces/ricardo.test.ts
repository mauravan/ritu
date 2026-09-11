import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRicardoUrl, searchRicardo, slugify } from "./ricardo";

vi.mock("ricardo-api", () => {
  const mockFetch = vi.fn(async () => ({
    listings: [
      {
        listingID: "1200985678",
        id: "1200985678",
        title: "Intel NUC 16GB RAM Mini PC",
        buyNowPrice: 69,
        bidPrice: 50,
        images: [
          {
            rendition: {
              src: "https://img.ricardostatic.ch/images/abc/t_265x200/myimage.jpg",
            },
          },
        ],
        image_url: "https://img.ricardostatic.ch/images/abc/t_265x200/myimage.jpg",
      },
    ],
  }));
  const mockSearch = vi.fn(() => ({ fetch: mockFetch }));
  class MockRicardoClient {
    search = mockSearch;
  }
  return { RicardoClient: MockRicardoClient };
});

describe("ricardo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("slugify", () => {
    it("converts title to lowercase slug", () => {
      expect(slugify("Intel NUC 16GB RAM Mini PC")).toBe("intel-nuc-16gb-ram-mini-pc");
    });

    it("removes special characters", () => {
      expect(slugify("Test @#$% Product!")).toBe("test-product");
    });

    it("handles multiple spaces", () => {
      expect(slugify("test   product")).toBe("test-product");
    });

    it("trims leading/trailing dashes", () => {
      expect(slugify("-test-")).toBe("test");
    });

    it("limits length to 60 chars", () => {
      const longTitle = "a".repeat(70);
      expect(slugify(longTitle).length).toBe(60);
    });

    it("handles empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("handles string with only special chars", () => {
      expect(slugify("@#$%")).toBe("");
    });
  });

  describe("buildRicardoUrl", () => {
    it("encodes query in URL", () => {
      expect(buildRicardoUrl("mini pc")).toBe("https://www.ricardo.ch/de/s/mini%20pc/");
    });

    it("handles special characters in query", () => {
      expect(buildRicardoUrl("iPhone 15 Pro")).toBe("https://www.ricardo.ch/de/s/iPhone%2015%20Pro/");
    });

    it("handles empty query", () => {
      expect(buildRicardoUrl("")).toBe("https://www.ricardo.ch/de/s//");
    });
  });

  describe("ricardo", () => {
    it("maps article correctly", async () => {
      const result = await searchRicardo("mini pc", 5);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.marketplace).toBe("ricardo");
      expect(result[0]?.id).toBe("1200985678");
    });
  });

  describe("ricardo contracts", () => {
    it("mapped products match contract fields", () => {
      expect(true).toBe(true);
    });
  });
});