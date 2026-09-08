// Tutti adapter — primary tutti-api (GraphQL) + Playwright fallback
// Primary tutti-api path is parallel-safe (rate-limited via tuttiLimiter, 1 req/s default).
// Playwright fallback is also rate-limited via tuttiLimiter; caller no longer needs outer p-limit(1) for tutti (kept for backward compat).

import type { RawProduct } from "../types";
import { withTuttiLimit, withRetry } from "./rateLimit";
import { searchTuttiViaApi } from "./tuttiApi";

let browser: import("playwright").Browser | null = null;

async function getBrowser(): Promise<import("playwright").Browser> {
  if (browser) return browser;
  const { chromium } = await import("playwright");
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  process.on("SIGTERM", () => {
    void browser?.close();
  });
  return browser;
}

export function buildTuttiUrl(query: string): string {
  return `https://www.tutti.ch/de/q/${encodeURIComponent(query)}`;
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  let m = text.match(/CHF\s*([\d'.,]+)/i);
  if (m?.[1]) {
    const num = m[1].replace(/['\s]/g, "").replace(",", ".");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  m = text.match(/([\d'.,]+)\s*\.-/);
  if (m?.[1]) {
    const num = m[1].replace(/['\s]/g, "").replace(",", ".");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  const trimmed = text.trim();
  if (/^[\d'.,\s]+$/.test(trimmed) && trimmed.length < 20) {
    const num = trimmed.replace(/['\s]/g, "").replace(",", ".").replace(/\.-$/, "");
    const val = parseFloat(num);
    return Number.isNaN(val) ? null : val;
  }
  return null;
}

function extractFromFetchHtml(html: string, limit: number): RawProduct[] {
  const products: RawProduct[] = [];
  const regex = /<a[^>]+href="(\/de\/vi\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(html)) !== null && products.length < limit) {
    const href = match[1];
    const inner = match[2] ?? "";
    const title = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!title || title.length < 3) continue;
    const after = html.slice(match.index, match.index + 4000);
    const priceChf = parsePrice(after);
    const imgMatch = after.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const imgRaw = imgMatch?.[1];
    const imageUrl = imgRaw
      ? imgRaw.startsWith("//")
        ? `https:${imgRaw}`
        : imgRaw.startsWith("http")
          ? imgRaw
          : `https://www.tutti.ch${imgRaw}`
      : null;
    const hrefVal = href ?? `/de/vi/tutti-${idx++}`;
    const id = hrefVal.split("/").pop() ?? `tutti-${idx++}`;
    const url = `https://www.tutti.ch${hrefVal}`;
    products.push({
      id,
      marketplace: "tutti",
      title: title || hrefVal,
      priceChf,
      currency: "CHF",
      condition: null,
      imageUrl: imageUrl && imageUrl.startsWith("http") ? imageUrl : null,
      url,
      location: null,
      raw: { href: hrefVal, inner: inner.slice(0, 500) },
    });
  }
  return products;
}

export async function searchTutti(
  query: string,
  limit = 20,
): Promise<RawProduct[]> {
  console.log(`[RITU][TUTTI] search query="${query}" limit=${limit}`);

  // 1. Primary: tutti-api (rate-limited via tuttiLimiter, with 429 retry)
  try {
    const apiResults = await withTuttiLimit(() =>
      withRetry(() => searchTuttiViaApi(query, limit), "tutti"),
    );
    if (apiResults.length > 0) return apiResults;
    console.warn(`[RITU][TUTTI] tutti-api returned empty for "${query}", falling back to Playwright`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[RITU][TUTTI] tutti-api failed for "${query}": ${msg} falling back to Playwright`);
  }

  // 2. Playwright fallback (rate-limited via tuttiLimiter)
  let playwrightResults: RawProduct[] = [];
  try {
    playwrightResults = await withTuttiLimit(async () => {
      const b = await getBrowser();
      const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124";
      const context = await b.newContext({ userAgent });

      const page = await context.newPage();
      try {
        await page.goto(buildTuttiUrl(query), { waitUntil: "domcontentloaded", timeout: 15000 });

        const found = await page
          .waitForSelector('a[href*="/de/vi/"], [data-testid*="listing"], div:has-text("CHF")', {
            timeout: 8000,
          })
          .catch(() => null);

        if (!found) {
          const content = await page.content();
          console.warn(
            `[RITU] tutti no listings selector for ${query} content slice: ${content.slice(0, 2000)}`,
          );
          return [];
        }

        const rawCards = await page.$$eval(
          'a[href*="/de/vi/"]',
          (els, lim) => {
            return els.slice(0, lim as number).map((el) => {
              const a = el as HTMLAnchorElement;
              const href = a.getAttribute("href") || "";
              const title = (a.textContent || a.getAttribute("title") || "").trim().slice(0, 200);
              const img = a.querySelector("img");
              const imgSrc =
                img?.getAttribute("src") ||
                img?.getAttribute("data-src") ||
                img?.getAttribute("data-lazy-src") ||
                (img?.getAttribute("srcset")?.split(" ")?.[0] ?? null);
              let priceText = "";
              let node: Element | null = a;
              for (let i = 0; i < 3 && node; i++) {
                const txt = node.textContent || "";
                if (txt.includes("CHF") || txt.includes(".-")) {
                  priceText = txt;
                  break;
                }
                node = node.parentElement;
              }
              return { href, title, imgSrc, priceText };
            });
          },
          limit as unknown as never,
        );
        const products: RawProduct[] = rawCards.map((c, idx) => {
          const href = (c as { href: string }).href;
          const title = (c as { title: string }).title || href;
          const imgSrc = (c as { imgSrc: string | null }).imgSrc;
          const priceText = (c as { priceText: string }).priceText;
          const priceChf = (() => {
            if (!priceText) return null;
            let m = priceText.match(/CHF\s*([\d'.,]+)/i);
            if (m?.[1]) {
              const n = parseFloat(m[1].replace(/['\s]/g, "").replace(",", "."));
              return Number.isNaN(n) ? null : n;
            }
            m = priceText.match(/([\d'.,]+)\s*\.-/);
            if (m?.[1]) {
              const n = parseFloat(m[1].replace(/['\s]/g, "").replace(",", "."));
              return Number.isNaN(n) ? null : n;
            }
            const trimmed = priceText.trim();
            if (/^[\d'.,\s]+$/.test(trimmed) && trimmed.length < 20) {
              const n = parseFloat(trimmed.replace(/['\s]/g, "").replace(",", ".").replace(/\.-$/, ""));
              return Number.isNaN(n) ? null : n;
            }
            return null;
          })();
          const id = href.split("/").pop() || `tutti-${idx}`;
          const url = href.startsWith("http") ? href : `https://www.tutti.ch${href}`;
          let imageUrl: string | null = null;
          if (imgSrc) {
            if (imgSrc.startsWith("//")) imageUrl = `https:${imgSrc}`;
            else if (imgSrc.startsWith("http")) imageUrl = imgSrc;
            else if (imgSrc.startsWith("/")) imageUrl = `https://www.tutti.ch${imgSrc}`;
          }
          return {
            id,
            marketplace: "tutti" as const,
            title: title.slice(0, 200),
            priceChf,
            currency: "CHF" as const,
            condition: null,
            imageUrl,
            url,
            location: null,
            raw: c as unknown,
          };
        });

        const seen = new Set<string>();
        const deduped: RawProduct[] = [];
        for (const p of products) {
          if (seen.has(p.url)) continue;
          seen.add(p.url);
          deduped.push(p);
        }

        return deduped.slice(0, limit);
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("executablePath") ||
      msg.includes("playwright_not_installed") ||
      msg.includes("browser")
    ) {
      console.warn(`[RITU] tutti playwright not installed for ${query}: ${msg}`);
    } else {
      console.warn(`[RITU] tutti failed for ${query}: ${msg}`);
    }
    if (msg.includes("Executable doesn't exist")) {
      console.warn("[RITU] playwright_not_installed — run npx playwright install chromium");
    }
    return [];
  }
  return playwrightResults;
}
