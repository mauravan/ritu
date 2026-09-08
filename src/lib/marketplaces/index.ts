import type { RawProduct } from "../types";

export interface MarketplaceAdapter {
  readonly name: "ricardo" | "tutti";
  search(query: string, auth: { cookies: string; storageState?: string; expiresAt: string } | null, limit?: number): Promise<RawProduct[]>;
  buildUrl(query: string): string;
}

export { searchRicardo, buildRicardoUrl } from "./ricardo";
export { searchTutti, buildTuttiUrl } from "./tutti";
