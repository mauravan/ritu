import { aggregate } from "./aggregate";
import { logger } from "./logger";
import { buildRicardoUrl, searchRicardo } from "./marketplaces/ricardo";
import { buildTuttiUrl, searchTutti } from "./marketplaces/tutti";
import { parseRequirementValue } from "./parseRequirementValue";
import type { DerivedSpec, MarketplaceQuery, Platform, RawProduct } from "./types";

export function buildMarketplaceQueries(
  searchQueries: string[],
  platform: Platform,
): MarketplaceQuery[] {
  return searchQueries.flatMap((q) => {
    const arr: MarketplaceQuery[] = [];
    if (platform === "both" || platform === "ricardo")
      arr.push({ marketplace: "ricardo" as const, query: q, url: buildRicardoUrl(q) });
    if (platform === "both" || platform === "tutti")
      arr.push({ marketplace: "tutti" as const, query: q, url: buildTuttiUrl(q) });
    return arr;
  });
}
export function augmentSearchQueries(searchQueries: string[], spec: DerivedSpec): string[] {
  const required = spec.requirements
    .filter((r) => r.importance === "required")
    .map((r) => r.value.trim())
    .filter(Boolean);
  if (required.length === 0) return searchQueries;

  // Separate compound/keyword additions from numeric/range constraints
  const compoundOptionsList: string[][] = [];
  const keywordAdditions: string[] = [];
  for (const reqValue of required) {
    const parsed = parseRequirementValue(reqValue);
    // If compound OR (e.g. "Intel i5 or AMD Ryzen 5"), expand each option as separate query variants
    if (parsed.compoundOptions && parsed.compoundOptions.length > 1) {
      compoundOptionsList.push(parsed.compoundOptions.map((o) => o.trim()).filter(Boolean));
    } else if (parsed.numericValue === 0 && !/\d/.test(reqValue)) {
      // Non-numeric keyword requirement (e.g. CPU brand without number)
      keywordAdditions.push(reqValue);
    }
    // Numeric/minimum values intentionally excluded from marketplace queries
  }

  // If there are compound options, expand searchQueries: one base + per option variants
  if (compoundOptionsList.length > 0) {
    const expanded: string[] = [];
    // Base queries (no compound option injection - handled by separate variants)
    expanded.push(...searchQueries);
    for (const options of compoundOptionsList) {
      for (const q of searchQueries) {
        for (const opt of options) {
          const combined = `${q} ${opt}`.trim();
          expanded.push(combined);
        }
      }
    }
    // Deduplicate and combine with keyword additions
    const uniqueExpanded = Array.from(new Set(expanded));
    if (keywordAdditions.length === 0) return uniqueExpanded;
    const withKeywords = uniqueExpanded.map((q) => {
      const qLower = q.toLowerCase();
      const additions = keywordAdditions.filter((v) => !qLower.includes(v.toLowerCase()));
      return additions.length > 0 ? `${q} ${additions.join(" ")}` : q;
    });
    return Array.from(new Set(withKeywords));
  }

  // No compound: simple keyword augmentation
  if (keywordAdditions.length === 0) return searchQueries;
  return searchQueries.map((q) => {
    const qLower = q.toLowerCase();
    const additions = keywordAdditions.filter((v) => !qLower.includes(v.toLowerCase()));
    return additions.length > 0 ? `${q} ${additions.join(" ")}` : q;
  });
}

export async function searchMarketplaces(
  searchQueries: string[],
  platform: Platform,
): Promise<RawProduct[]> {
  const limitedQueries = searchQueries.slice(0, 3);
  const ricardoPromises: Promise<RawProduct[]>[] =
    platform === "both" || platform === "ricardo"
      ? limitedQueries.map((q) => searchRicardo(q, 20))
      : [];
  const tuttiPromises: Promise<RawProduct[]>[] =
    platform === "both" || platform === "tutti"
      ? limitedQueries.map((q) => searchTutti(q, 20))
      : [];
  const ricardoSettled = await Promise.allSettled(ricardoPromises);
  const tuttiSettled = await Promise.allSettled(tuttiPromises);

  const isFulfilled = <T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> =>
    r.status === "fulfilled";

  const ricardoGroups = ricardoSettled.filter(isFulfilled).map((r) => r.value);
  const tuttiGroups = tuttiSettled.filter(isFulfilled).map((r) => r.value);

  // Handle individual rejections (aggregate behavior unchanged; rejected promises excluded from results)
  for (const rej of ricardoSettled.filter(
    (r): r is PromiseSettledResult<any> & { status: "rejected"; reason: any } =>
      r.status === "rejected",
  )) {
    const reason = (rej as { reason: any }).reason;
    logger.error({
      msg: "[RITU][SEARCH] ricardo promise rejected:",
      reason,
      reasonType: reason === null ? "null" : typeof reason,
      message:
        reason && typeof reason === "object"
          ? String((reason as any)?.message ?? "")
          : String(reason ?? ""),
      stack: reason && typeof reason === "object" ? String((reason as any)?.stack ?? "") : "",
      stringified: String(reason ?? ""),
    });
  }
  for (const rej of tuttiSettled.filter(
    (r): r is PromiseSettledResult<any> & { status: "rejected"; reason: any } =>
      r.status === "rejected",
  )) {
    const reason = (rej as { reason: any }).reason;
    logger.error({
      msg: "[RITU][SEARCH] tutti promise rejected:",
      reason,
      reasonType: reason === null ? "null" : typeof reason,
      message:
        reason && typeof reason === "object"
          ? String((reason as any)?.message ?? "")
          : String(reason ?? ""),
      stack: reason && typeof reason === "object" ? String((reason as any)?.stack ?? "") : "",
      stringified: String(reason ?? ""),
    });
  }
  const ricardoFlat = ricardoGroups.flat();
  const tuttiFlat = tuttiGroups.flat();
  const raw = aggregate([...ricardoGroups, ...tuttiGroups]);
  logger.info(
    `[RITU][SEARCH] aggregate raw=${raw.length} (ricardo ${ricardoFlat.length}+tutti ${tuttiFlat.length} -> dedup ${raw.length})`,
  );

  logger.info(`[RITU][SEARCH] deterministic ranked=${raw.length}`);

  return raw;
}
