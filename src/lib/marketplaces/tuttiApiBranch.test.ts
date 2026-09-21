import { describe, expect, it, vi } from "vitest";
import { searchTuttiViaApi } from "./tuttiApi";

describe("searchTuttiViaApi branches", () => {
  it("returns empty when API yields no listings", async () => {
    const { TuttiClient } = await import("tutti-api");
    vi.spyOn(TuttiClient.prototype, "search").mockReturnValue({
      fetch: async () => ({ listings: [] }),
    } as never);
    const out = await searchTuttiViaApi("mini pc", 5);
    expect(out).toEqual([]);
    vi.restoreAllMocks();
  });

  it("rethrows rate-limit errors", async () => {
    const { TuttiClient } = await import("tutti-api");
    vi.spyOn(TuttiClient.prototype, "search").mockReturnValue({
      fetch: async () => {
        throw new Error("429 too many");
      },
    } as never);
    await expect(searchTuttiViaApi("mini pc", 5)).rejects.toThrow("429 too many");
    vi.restoreAllMocks();
  });

  it("returns empty on generic failure", async () => {
    const { TuttiClient } = await import("tutti-api");
    vi.spyOn(TuttiClient.prototype, "search").mockReturnValue({
      fetch: async () => {
        throw new Error("network down");
      },
    } as never);
    const out = await searchTuttiViaApi("mini pc", 5);
    expect(out).toEqual([]);
    vi.restoreAllMocks();
  });
});
