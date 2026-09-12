import { aggregate } from "./aggregate";
import { buildRicardoUrl, searchRicardo } from "./marketplaces/ricardo";
import { buildTuttiUrl, searchTutti } from "./marketplaces/tutti";
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
  return searchQueries.map((q) => {
    const qLower = q.toLowerCase();
    const additions = required.filter((v) => !qLower.includes(v.toLowerCase()));
    return additions.length > 0 ? `${q} ${additions.join(" ")}` : q;
  });
}

export async function searchMarketplaces(
  searchQueries: string[],
  platform: Platform,
): Promise<RawProduct[]> {
  const ricardoPromises: Promise<RawProduct[]>[] =
    platform === "both" || platform === "ricardo"
      ? searchQueries.map((q) => searchRicardo(q, 20))
      : [];
  const tuttiPromises: Promise<RawProduct[]>[] =
    platform === "both" || platform === "tutti" ? searchQueries.map((q) => searchTutti(q, 20)) : [];

  const ricardoSettled = await Promise.allSettled(ricardoPromises);
  const tuttiSettled = await Promise.allSettled(tuttiPromises);

  const isFulfilled = <T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> =>
    r.status === "fulfilled";

  const ricardoGroups = ricardoSettled.filter(isFulfilled).map((r) => r.value);
  const tuttiGroups = tuttiSettled.filter(isFulfilled).map((r) => r.value);

  // Handle individual rejections (aggregate behavior unchanged; rejected promises excluded from results)
  for (const rej of ricardoSettled.filter((r) => r.status === "rejected")) {
    console.error(
      "[RITU][SEARCH] ricardo promise rejected:",
      (rej as PromiseRejectedResult).reason,
    );
  }
  for (const rej of tuttiSettled.filter((r) => r.status === "rejected")) {
    console.error("[RITU][SEARCH] tutti promise rejected:", (rej as PromiseRejectedResult).reason);
  }
  const ricardoFlat = ricardoGroups.flat();
  const tuttiFlat = tuttiGroups.flat();
  const raw = aggregate([...ricardoGroups, ...tuttiGroups]);
  console.log(
    `[RITU][SEARCH] aggregate raw=${raw.length} (ricardo ${ricardoFlat.length}+tutti ${tuttiFlat.length} -> dedup ${raw.length})`,
  );

  console.log(`[RITU][SEARCH] deterministic ranked=${raw.length}`);

  return raw;
}
