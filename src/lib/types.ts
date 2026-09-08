export type DerivedSpec = {
  category: string;
  summary: string;
  requirements: { key: string; value: string; importance: "required" | "preferred" }[];
  searchQueries: string[];
  excludedTerms: string[];
};

export type MarketplaceQuery = { marketplace: "ricardo" | "tutti"; query: string; url: string };

export type RawProduct = {
  id: string;
  marketplace: "ricardo" | "tutti";
  title: string;
  priceChf: number | null;
  currency: "CHF";
  condition: string | null;
  imageUrl: string | null;
  url: string;
  location: string | null;
  raw: unknown;
};

export type RankedProduct = RawProduct & {
  specScore: number;
  valueScore: number;
  tags: Tag[];
  matchedRequirements: string[];
  reasons: string[];
};

export type Tag = "best value" | "best specs" | "cheapest" | "best condition" | "balanced";

export type SearchResult = {
  input: string;
  derivedSpec: DerivedSpec;
  queries: MarketplaceQuery[];
  products: RankedProduct[];
  authUsed: { ricardo: boolean; tutti: boolean };
};

export type AuthContext = {
  ricardo: { cookies: string; expiresAt: string } | null;
  tutti: { cookies: string; storageState?: string; expiresAt: string } | null;
} | null;

export type AuthStatus = { ricardo: boolean; tutti: boolean };
