// Ricardo adapter — verified JSON API
// Documented HTML fallback deferred to follow-up

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

export async function searchRicardo(
  query: string,
  auth: { cookies: string } | null,
  limit = 20,
): Promise<RawProduct[]> {
  const url = `https://www.ricardo.ch/api/mfa/search?searchTerm=${encodeURIComponent(query)}&size=${limit}&apiToken=`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RITU/1.0",
  };
  if (auth?.cookies) {
    headers["Cookie"] = auth.cookies;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[RITU] ricardo failed: ${query} ${res.status}`);
      // If auth expired, fallback to anon is handled by orchestrator returning [] then retry? Here just return []
      return [];
    }

    const data = (await res.json()) as unknown;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articles = (data as any)?.articles;
    if (!Array.isArray(articles)) {
      console.warn(`[RITU] ricardo no articles for ${query}`);
      return [];
    }

    const mapped: RawProduct[] = articles.map((a: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const art = a as any;
      const id = String(art.id ?? art.articleId ?? "");
      const title = String(art.title ?? "");
      const buyNowPrice = typeof art.buyNowPrice === "number" ? art.buyNowPrice : null;
      const bidPrice = typeof art.bidPrice === "number" ? art.bidPrice : null;
      const priceChf = buyNowPrice ?? bidPrice ?? null;
      const imageRaw = art.image ?? art.imageUrl ?? null;
      const imageUrl = typeof imageRaw === "string" ? imageRaw.replace("t_265x200", "t_800x600") : null;
      const condition = typeof art.conditionKey === "string" ? art.conditionKey : null;
      const shipping = Array.isArray(art.shipping) ? art.shipping : [];
      const location = shipping[0]?.city ?? null;
      const slug = slugify(title);
      const urlProd = `https://www.ricardo.ch/de/a/${slug}-${id}/`;

      return {
        id,
        marketplace: "ricardo" as const,
        title,
        priceChf,
        currency: "CHF" as const,
        condition,
        imageUrl,
        url: urlProd,
        location,
        raw: a,
      } satisfies RawProduct;
    });

    // dedup by id
    const seen = new Set<string>();
    const deduped: RawProduct[] = [];
    for (const p of mapped) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      deduped.push(p);
    }
    return deduped;
  } catch (err) {
    console.warn(`[RITU] ricardo failed: ${query} ${err}`);
    return [];
  }
}
