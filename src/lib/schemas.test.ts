import { describe, expect, it } from "vitest";
import {
  DerivedSpecSchema,
  MarketplaceQuerySchema,
  RankedProductSchema,
  RawProductSchema,
  SearchRequestSchema,
  SearchResultSchema,
} from "./schemas";

describe("schemas contracts", () => {
  const spec = {
    category: "mini pc",
    summary: "Small server",
    requirements: [{ key: "RAM", value: "16GB", importance: "required" as const }],
    searchQueries: ["mini pc"],
    excludedTerms: ["raspberry"],
  };

  it("DerivedSpecSchema .strict() rejects extra keys", () => {
    const result = DerivedSpecSchema.strict().safeParse({ ...spec, extra: 1 });
    expect(result.success).toBe(false);
  });

  it("DerivedSpecSchema .optional() allows optional fields", () => {
    const result = DerivedSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("MarketplaceQuerySchema validates marketplace enum", () => {
    expect(
      MarketplaceQuerySchema.safeParse({
        marketplace: "tutti",
        query: "x",
        url: "y",
      }).success,
    ).toBe(true);
    expect(
      MarketplaceQuerySchema.safeParse({
        marketplace: "bad",
        query: "x",
        url: "y",
      }).success,
    ).toBe(false);
  });

  it("RawProductSchema requires currency CHF literal", () => {
    expect(
      RawProductSchema.safeParse({
        id: "1",
        marketplace: "ricardo",
        title: "t",
        priceChf: 10,
        currency: "CHF",
        condition: null,
        imageUrl: null,
        url: "u",
        location: null,
        raw: {},
      }).success,
    ).toBe(true);
  });

  it("RankedProductSchema extends RawProduct", () => {
    const base = {
      id: "1",
      marketplace: "ricardo" as const,
      title: "t",
      priceChf: null,
      currency: "CHF" as const,
      condition: null,
      imageUrl: null,
      url: "u",
      location: null,
      raw: {},
      specScore: 50,
      valueScore: 30,
      tags: ["best specs" as const],
      matchedRequirements: ["RAM: 16GB"],
      reasons: ["price"],
    };
    expect(RankedProductSchema.safeParse(base).success).toBe(true);
  });

  it("SearchResultSchema validates platform enum optional", () => {
    expect(
      SearchResultSchema.safeParse({
        input: "q",
        derivedSpec: spec,
        queries: [{ marketplace: "ricardo", query: "q", url: "u" }],
        products: [
          {
            id: "1",
            marketplace: "ricardo",
            title: "t",
            priceChf: null,
            currency: "CHF",
            condition: null,
            imageUrl: null,
            url: "u",
            location: null,
            raw: {},
            specScore: 10,
            valueScore: 5,
            tags: ["balanced"],
            matchedRequirements: [],
            reasons: [],
          },
        ],
        specScoringSource: "deterministic",
      }).success,
    ).toBe(true);
  });

  it("SearchRequestSchema enforces min/max length", () => {
    expect(SearchRequestSchema.safeParse({ query: "a" }).success).toBe(false);
    expect(SearchRequestSchema.safeParse({ query: "valid" }).success).toBe(true);
  });

  it("SearchRequestSchema accepts askedQuestions history", () => {
    const result = SearchRequestSchema.safeParse({
      query: "laptop i7",
      askedQuestions: ["How strong should the CPU be?"],
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.askedQuestions).toEqual(["How strong should the CPU be?"]);
  });
});
