import { describe, expect, it, vi } from "vitest";
import { searchRicardo } from "./ricardo";

const mockSearch = vi.hoisted(() => vi.fn());

vi.mock("ricardo-api", () => ({
  RicardoClient: class {
    search(...args: unknown[]) {
      return mockSearch(...args);
    }
  },
}));

describe("searchRicardo mapping branches", () => {
  it("maps bid-only price and image_url fallback", async () => {
    mockSearch.mockReturnValueOnce({
      fetch: async () => ({
        listings: [
          {
            id: "9",
            title: "Mini PC",
            bidPrice: 5000,
            image_url: "https://img/t_265x200/pic.jpg",
            city: "Bern",
            zip_code: "3000",
          },
        ],
      }),
    });
    const out = await searchRicardo("mini pc", 5);
    expect(out[0]?.priceChf).toBe(50);
    expect(out[0]?.bidPriceChf).toBe(50);
    expect(out[0]?.listedPriceChf).toBeNull();
    expect(out[0]?.imageUrl).toContain("t_800x600");
    expect(out[0]?.location).toBe("Bern");
    expect(out[0]?.zipCode).toBe("3000");
  });

  it("maps null price with no image and dedups by id", async () => {
    mockSearch.mockReturnValueOnce({
      fetch: async () => ({
        listings: [
          { listingID: "1", title: "Same", buyNowPrice: null, bidPrice: null },
          { listingID: "1", title: "Same", buyNowPrice: null, bidPrice: null },
          { listingID: "", title: "Empty id" },
        ],
      }),
    });
    const out = await searchRicardo("mini pc", 5);
    expect(out.map((p) => p.id)).toEqual(["1"]);
  });

  it("caps results at limit", async () => {
    mockSearch.mockReturnValueOnce({
      fetch: async () => ({
        listings: [
          { listingID: "1", title: "A" },
          { listingID: "2", title: "B" },
          { listingID: "3", title: "C" },
        ],
      }),
    });
    const out = await searchRicardo("mini pc", 2);
    expect(out.length).toBe(2);
  });
});
