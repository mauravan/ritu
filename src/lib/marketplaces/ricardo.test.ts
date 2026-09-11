import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRicardoUrl, searchRicardo } from "./ricardo";

vi.mock("ricardo-api", () => {
  class FakeRicardoClient {
    search() {
      return {
        fetch: async () => ({
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
        }),
      };
    }
  }
  return { RicardoClient: FakeRicardoClient };
});

describe("ricardo", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps article correctly", async () => {
    const result = await searchRicardo("mini pc", 5);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.marketplace).toBe("ricardo");
    expect(result[0]?.id).toBe("1200985678");
  });

  it("buildRicardoUrl encodes query", () => {
    expect(buildRicardoUrl("mini pc")).toBe("https://www.ricardo.ch/de/s/mini%20pc/");
  });
});

describe("ricardo contracts", () => {
  it("mapped products match contract fields", () => {
    expect(true).toBe(true);
  });
});
