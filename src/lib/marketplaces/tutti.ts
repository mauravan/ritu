// Tutti adapter — tutti-api (GraphQL) only (no Playwright fallback)
// Parallel-safe via tuttiLimiter (1 req/s default).

import type { RawProduct } from "../types";
import { withRetry, withTuttiLimit } from "./rateLimit";
import { searchTuttiViaApi } from "./tuttiApi";

export function buildTuttiUrl(query: string): string {
  return `https://www.tutti.ch/de/q/${encodeURIComponent(query)}`;
}

export async function searchTutti(query: string, limit = 20): Promise<RawProduct[]> {
  console.log(`[RITU][TUTTI] search query="${query}" limit=${limit}`);
  return withTuttiLimit(() => withRetry(() => searchTuttiViaApi(query, limit), "tutti"));
}
