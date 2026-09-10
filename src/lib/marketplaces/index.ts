import type { RawProduct } from "../types";

export interface MarketplaceAdapter {
  readonly name: "ricardo" | "tutti";
  search(query: string, limit?: number): Promise<RawProduct[]>;
  buildUrl(query: string): string;
}

export { buildRicardoUrl, searchRicardo } from "./ricardo";
export { buildTuttiUrl, searchTutti } from "./tutti";
