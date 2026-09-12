import { describe, expect, it } from "vitest";
import { augmentSearchQueries } from "./searchMarketplaces";
import type { DerivedSpec } from "./types";

const spec: DerivedSpec = {
  category: "laptop",
  summary: "",
  requirements: [
    { key: "cpu", value: "i7", importance: "required" },
    { key: "ram", value: "32 GB", importance: "required" },
  ],
  searchQueries: ["laptop i7"],
  excludedTerms: [],
};

describe("augmentSearchQueries", () => {
  it("does not append numeric/minimum terms to marketplace queries", () => {
    expect(augmentSearchQueries(["laptop i7"], spec)).toEqual(["laptop i7"]);
  });

  it("skips values already present case-insensitively", () => {
    const s: DerivedSpec = {
      ...spec,
      searchQueries: ["laptop i7 32 gb"],
    };
    expect(augmentSearchQueries(["laptop i7 32 gb"], s)).toEqual(["laptop i7 32 gb"]);
  });

  it("returns unchanged when no required requirements", () => {
    const s: DerivedSpec = {
      ...spec,
      requirements: [{ key: "cpu", value: "i7", importance: "preferred" }],
    };
    expect(augmentSearchQueries(["laptop i7"], s)).toEqual(["laptop i7"]);
  });

  it("ignores empty or whitespace-only values", () => {
    const s: DerivedSpec = {
      ...spec,
      requirements: [
        { key: "cpu", value: "i7", importance: "required" },
        { key: "ram", value: "  ", importance: "required" },
      ],
    };
    expect(augmentSearchQueries(["laptop i7"], s)).toEqual(["laptop i7"]);
  });
});
