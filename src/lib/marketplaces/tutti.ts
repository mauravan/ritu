// Tutti adapter — tutti-api (GraphQL) only (no Playwright fallback)
import { logger } from "../logger";
// Parallel-safe via tuttiLimiter (1 req/s default).

import type { RawProduct } from "../types";
import { withRetry, withTuttiLimit } from "./rateLimit";
import { searchTuttiViaApi } from "./tuttiApi";

export function buildTuttiUrl(query: string): string {
  return `https://www.tutti.ch/de/q/${encodeURIComponent(query)}`;
}

export async function searchTutti(
  query: string,
  limit = 20,
  opts?: { zipCode?: string; radius?: number },
): Promise<RawProduct[]> {
  logger.info(`[RITU][TUTTI] search query="${query}" limit=${limit}`);
  return withTuttiLimit(async () => {
    logger.info(`[RITU][TUTTI] withTuttiLimit start query="${query}"`);
    const result = await withRetry(() => searchTuttiViaApi(query, limit, opts), "tutti");
    logger.info(`[RITU][TUTTI] withTuttiLimit end query="${query}" result=${result.length}`);
    return result;
  });
}
