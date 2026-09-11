// Ricardo adapter — now backed by ricardo-api library
import { RicardoClient } from "ricardo-api";
import type { RawProduct } from "../types";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function buildRicardoUrl(query: string): string {
  return `https://www.ricardo.ch/de/s/${encodeURIComponent(query)}/`;
}

export async function searchRicardo(query: string, limit = 20): Promise<RawProduct[]> {
  // ricardo-api uses mobile endpoint /m/search with AWS SigV4 (x-authorization);
  // web session cookies are not used by this endpoint and cause 403 from WAF.
  const client = new RicardoClient();
  const _result = await client.search(query).fetch();
  interface RicardoListing {
    listingID?: string | number;
    id?: string | number;
    title?: string;
    buyNowPrice?: string | number;
    bidPrice?: string | number;
    images?: Array<{ rendition?: { src?: string } }>;
    image_url?: string;
  }
  const mapped: RawProduct[] = _result.listings.slice(0, limit).map((a: RicardoListing) => {
    const id = String(a.listingID ?? a.id ?? "");
    const title = String(a.title ?? "");
    const priceChf =
      a.buyNowPrice != null
        ? Number(a.buyNowPrice) / 100
        : a.bidPrice != null
          ? Number(a.bidPrice) / 100
          : null;
    const imageUrl = a.images?.[0]?.rendition?.src ?? a.image_url ?? null;
    return {
      id,
      marketplace: "ricardo" as const,
      title,
      priceChf,
      bidPriceChf: a.bidPrice != null ? Number(a.bidPrice) / 100 : null,
      listedPriceChf: priceChf,
      currency: "CHF" as const,
      condition: null,
      imageUrl: typeof imageUrl === "string" ? imageUrl.replace("t_265x200", "t_800x600") : null,
      url: `https://www.ricardo.ch/de/a/${slugify(title)}-${id}/`,
      location: null,
      raw: a,
    } satisfies RawProduct;
  });
  const seen = new Set<string>();
  return mapped.filter((p) => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// Test exports
export { slugify };
