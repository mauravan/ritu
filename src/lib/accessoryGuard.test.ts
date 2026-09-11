import { describe, expect, it } from "vitest";
import { sanitizeSearchQueries } from "./accessoryGuard";
import type { DerivedSpec } from "./types";

function spec(category: string, searchQueries: string[]): DerivedSpec {
  return {
    category,
    summary: "test",
    requirements: [],
    searchQueries,
    excludedTerms: [],
  };
}

describe("sanitizeSearchQueries contracts", () => {
  it("drops accessory-token queries", () => {
    const result = sanitizeSearchQueries(spec("laptop", ["laptop", "laptop cover"]));
    expect(result).toEqual(["laptop"]);
  });

  it("restores original when all queries dropped", () => {
    const result = sanitizeSearchQueries(spec("laptop", ["laptop sleeve"]));
    expect(result).toEqual(["laptop sleeve"]);
  });

  it("leaves non-accessory queries unchanged", () => {
    const result = sanitizeSearchQueries(spec("gpu", ["rtx 4070", "gtx 1080"]));
    expect(result).toEqual(["rtx 4070", "gtx 1080"]);
  });
});
