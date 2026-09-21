import type { RawProduct } from "../types";

export interface MarketplaceAdapter {
  search(query: string, limit?: number): Promise<RawProduct[]>;
  buildUrl(query: string): string;
}

export { buildRicardoUrl, searchRicardo } from "./ricardo";
export { buildTuttiUrl, searchTutti } from "./tutti";
