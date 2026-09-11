import type { RawProduct } from "./types";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function aggregate(groups: RawProduct[][]): RawProduct[] {
  const flat = groups.flat();
  const byKey = new Map<string, RawProduct>();

  for (const p of flat) {
    const key = `${normalizeTitle(p.title)}|${p.priceChf ?? "null"}`;
    if (!byKey.has(key)) byKey.set(key, p);
  }

  // Also dedup by id/url exact
  const byId = new Map<string, RawProduct>();
  for (const p of byKey.values()) {
    const idKey = `${p.marketplace}:${p.id}`;
    if (!byId.has(idKey)) byId.set(idKey, p);
  }

  return Array.from(byId.values());
}

// Test exports
export { normalizeTitle };
