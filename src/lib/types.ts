import type { SpecScoringSource } from "./specScore/SpecScorer";

export type DerivedSpec = {
  category: string;
  summary: string;
  requirements: {
    key: string;
    value: string;
    importance: "required" | "preferred";
  }[];
  searchQueries: string[];
  excludedTerms: string[];
};

export type MarketplaceQuery = {
  marketplace: "ricardo" | "tutti";
  query: string;
  url: string;
};

export type RawProduct = {
  id: string;
  marketplace: "ricardo" | "tutti";
  title: string;
  priceChf: number | null;
  currency: "CHF";
  condition: string | null;
  imageUrl: string | null;
  url: string;
  bidPriceChf?: number | null;
  listedPriceChf?: number | null;
  location: string | null;
  zipCode?: string | null;
  raw: unknown;
};

export type RankedProduct = RawProduct & {
  specScore: number;
  valueScore: number;
  tags: Tag[];
  matchedRequirements: string[];
  reasons: string[];
  relevance?: number;
  hybridScore?: number;
};

export type Tag =
  | "best value"
  | "best specs"
  | "cheapest"
  | "best condition"
  | "balanced"
  | "best overall";

export type Platform = "both" | "ricardo" | "tutti";

export type Locale = "de" | "en";

export type SearchResult = {
  input: string;
  derivedSpec: DerivedSpec;
  queries: MarketplaceQuery[];
  products: RankedProduct[];
  platform?: Platform;
  specScoringSource: SpecScoringSource;
};

export type SortBy = "spec" | "value" | "ai" | "hybrid" | "price";
export type SortDir = "asc" | "desc";
