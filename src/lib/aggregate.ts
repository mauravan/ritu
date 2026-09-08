import type { RawProduct } from "./types";

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function aggregate(groups: RawProduct[][]): RawProduct[] {
  const flat = groups.flat();
  const byKey = new Map<string, RawProduct>();

  for (const p of flat) {
    const key = `${normalizeTitle(p.title)}|${p.priceChf ?? "null"}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
    } else {
      // keep cheapest when price both present
      if (p.priceChf !== null && existing.priceChf !== null) {
        if (p.priceChf < existing.priceChf) byKey.set(key, p);
      } else if (p.priceChf !== null && existing.priceChf === null) {
        byKey.set(key, p);
      }
      // otherwise keep existing
    }
  }

  // Also dedup by id/url exact
  const byId = new Map<string, RawProduct>();
  for (const p of byKey.values()) {
    const idKey = `${p.marketplace}:${p.id}`;
    if (!byId.has(idKey)) byId.set(idKey, p);
  }

  return Array.from(byId.values());
}
