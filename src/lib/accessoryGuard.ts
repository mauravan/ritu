import type { DerivedSpec } from "./types";
import { logger } from "./logger";

const ACCESSORY_TERMS: Record<string, true> = {
  hülle: true,
  huelle: true,
  tasche: true,
  sleeve: true,
  cover: true,
  case: true,
  halterung: true,
  schutz: true,
  folie: true,
  ständer: true,
  staender: true,
};

export function sanitizeSearchQueries(spec: DerivedSpec): string[] {
  // Defense in depth: sanitize searchQueries that leaked accessory terms
  const categoryLower = spec.category.toLowerCase();
  const isAccessoryCategory = Object.keys(ACCESSORY_TERMS).some((w) => categoryLower.includes(w));
  if (isAccessoryCategory) {
    return spec.searchQueries;
  }
  const before = spec.searchQueries.length;
  const originalQueries = [...spec.searchQueries];
  const excludedSet = new Set(spec.excludedTerms.map((t) => t.toLowerCase()));
  const filtered = spec.searchQueries.filter((q) => {
    const qLower = q.toLowerCase();
    if (excludedSet.has(qLower)) return false;
    const tokens = qLower.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const tok of tokens) {
      if (Object.hasOwn(ACCESSORY_TERMS, tok)) {
        logger.info(
          `[RITU][SEARCH] dropping accessory query "${q}" for category "${spec.category}"`,
        );
        return false;
      }
    }
    return true;
  });
  if (filtered.length === 0 && before > 0) {
    logger.warn(`[RITU][SEARCH] all queries dropped by accessory guard, restoring original`);
    return originalQueries;
  }
  if (filtered.length === 0) {
    return [spec.category];
  }
  return filtered;
}
