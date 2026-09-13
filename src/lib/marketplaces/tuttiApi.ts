import { type Listing, TuttiClient } from "tutti-api";
import { logger } from "../logger";
import type { RawProduct } from "../types";

function parsePrice(text: string): number | null {
  if (!text) return null;
  // CHF-prefixed (e.g. "CHF 1'234.50") — most explicit
  let m = text.match(/CHF\s*([\d'.,]+)/i);
  if (m?.[1]) {
    const num = m[1].replace(/['\s]/g, "").replace(",", ".");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  // Tutti API returns "650.-" / "1'200.-" without CHF — capture number before optional ".-"
  m = text.match(/([\d'.,]+)\s*\.-/);
  if (m?.[1]) {
    const num = m[1].replace(/['\s]/g, "").replace(",", ".");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  // Fallback: plain number if text is short price-only string (e.g. "650.-" already handled, but "125" etc.)
  const trimmed = text.trim();
  if (/^[\d'.,\s]+$/.test(trimmed) && trimmed.length < 20) {
    const num = trimmed.replace(/['\s]/g, "").replace(",", ".").replace(/\.-$/, "");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  return null;
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u = raw;
  if (u.startsWith("//")) u = `https:${u}`;
  else if (u.startsWith("/")) u = `https://www.tutti.ch${u}`;
  if (!u.startsWith("http")) return null;
  return u;
}

export function listingToRawProduct(listing: Listing): RawProduct {
  const id = String((listing as unknown as Record<string, unknown>).listingID ?? "");
  const title = String(listing.title ?? "").slice(0, 200);
  const formattedPrice =
    (listing.formattedPrice as string | undefined) ??
    ((listing as unknown as Record<string, unknown>).price as string | undefined) ??
    "";
  const priceChf = typeof formattedPrice === "string" ? parsePrice(formattedPrice) : null;

  const imageRaw = listing.images?.[0]?.rendition?.src ?? listing.thumbnail?.rendition?.src ?? null;
  const imageUrl = normalizeImageUrl(imageRaw as string | null);

  const url = `https://www.tutti.ch/de/vi/${id}`;
  const location =
    listing.postcodeInformation?.locationName ?? (listing.address as string | null) ?? null;

  return {
    id,
    marketplace: "tutti",
    title,
    priceChf,
    currency: "CHF",
    condition: null,
    imageUrl,
    url,
    location: location ?? null,
    raw: listing as unknown,
  };
}

export async function searchTuttiViaApi(query: string, limit: number): Promise<RawProduct[]> {
  logger.info(`[RITU][TUTTI-API] search query="${query}" limit=${limit}`);
  try {
    const client = new TuttiClient();

    const result = await Promise.race([
      client.search(query).fetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("tutti-api timeout 8000ms")), 8000),
      ),
    ]);

    const listings = result.listings ?? [];
    if (listings.length === 0) {
      logger.info(`[RITU][TUTTI-API] search query="${query}" -> 0 (no listings)`);
      return [];
    }

    const mapped = listings.map(listingToRawProduct).slice(0, limit);
    logger.info(`[RITU][TUTTI-API] search query="${query}" -> ${mapped.length}`);
    return mapped;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[RITU][TUTTI-API] failed for "${query}": ${msg} falling back`);
    const status = (err as Record<string, unknown>)?.status as number | undefined;
    if (msg.includes("429") || msg.includes("1015") || status === 429) throw err;
    return [];
  }
}

// Test exports
export { normalizeImageUrl, parsePrice };
