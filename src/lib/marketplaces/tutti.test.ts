import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("tutti-api", () => ({
  TuttiClient: vi.fn(function (this: unknown) {
    return {
      search: vi.fn(() => ({
        fetch: async () => ({
          listings: [
            {
              listingID: "1",
              title: "Mock PC",
              formattedPrice: "CHF 100",
              images: [{ rendition: { src: "https://cdn.tutti.ch/img.jpg" } }],
              thumbnail: { rendition: { src: "https://cdn.tutti.ch/thumb.jpg" } },
              postcodeInformation: { locationName: "Zurich" },
              address: "Zurich",
            },
          ],
        }),
      })),
    };
  }),
}));

vi.mock("./rateLimit", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("./rateLimit");
  return {
    ...actual,
    withTuttiLimit: (fn: () => Promise<unknown>) => fn(),
    withRicardoLimit: (fn: () => Promise<unknown>) => fn(),
    withRetry: (fn: () => Promise<unknown>) => fn(),
  };
});

import { buildTuttiUrl, searchTutti } from "./tutti";

describe("tutti", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("buildTuttiUrl encodes query", () => {
    expect(buildTuttiUrl("mini pc")).toBe("https://www.tutti.ch/de/q/mini%20pc");
  });

  it("searchTutti uses tutti-api and returns products", async () => {
    const result = await searchTutti("server", 2);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.marketplace).toBe("tutti");
  }, 5000);
});
