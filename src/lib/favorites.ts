import type { Locale, RawProduct } from "./types";

// Snapshot of a listing at save time. Explicit field list; NEVER include `raw` (huge, quota risk).
export type FavoriteListing = {
  id: string;
  marketplace: "ricardo" | "tutti";
  title: string;
  priceChf: number | null;
  currency: "CHF";
  condition: string | null;
  imageUrl: string | null;
  url: string;
  bidPriceChf: number | null;
  listedPriceChf: number | null;
  location: string | null;
};

export type FavoriteItem = {
  id: string; // favorite-entry id = crypto.randomUUID()
  listing: FavoriteListing;
  category: string; // trimmed, non-empty
  note: string; // "" when empty
  savedAt: number; // Date.now() epoch ms
};

export type FavoritesState = {
  categories: string[]; // ordered, unique, trimmed, non-empty
  items: FavoriteItem[];
};

export const FAVORITES_STORAGE_KEY = "ritu:favorites:v1";

export function emptyFavorites(): FavoritesState {
  return { categories: [], items: [] };
}

function normalizeCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function isValidItem(it: unknown): it is FavoriteItem {
  if (typeof it !== "object" || it === null) return false;
  const o = it as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.category !== "string") return false;
  if (typeof o.listing !== "object" || o.listing === null) return false;
  return true;
}

// SSR-safe: return emptyFavorites() when typeof window === "undefined".
export function loadFavorites(): FavoritesState {
  if (typeof window === "undefined") return emptyFavorites();
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return emptyFavorites();
    const parsed = JSON.parse(raw) as { categories?: unknown; items?: unknown };
    if (!Array.isArray(parsed?.categories) || !Array.isArray(parsed?.items)) {
      return emptyFavorites();
    }
    const categories = normalizeCategories(parsed.categories);
    const items = (parsed.items as unknown[]).filter(isValidItem);
    return { categories, items };
  } catch {
    return emptyFavorites();
  }
}

// try/catch JSON.stringify + localStorage.setItem; on failure silently return (matches theme/locale).
export function saveFavorites(state: FavoritesState): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silently ignore (quota/private-mode); matches theme/locale pattern
  }
}

// RankedProduct → FavoriteListing (explicit picks; drops `raw` and `zipCode`).
export function toFavoriteListing(p: RawProduct): FavoriteListing {
  return {
    id: p.id,
    marketplace: p.marketplace,
    title: p.title,
    priceChf: p.priceChf,
    currency: "CHF",
    condition: p.condition,
    imageUrl: p.imageUrl,
    url: p.url,
    bidPriceChf: p.bidPriceChf ?? null,
    listedPriceChf: p.listedPriceChf ?? null,
    location: p.location,
  };
}

export function formatSavedAt(savedAt: number, locale: Locale, justNow: string): string {
  const diffMs = Date.now() - savedAt;
  if (diffMs < 60_000) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale === "de" ? "de" : "en", { numeric: "auto" });
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return rtf.format(-weeks, "week");
  return new Intl.DateTimeFormat(locale === "de" ? "de-CH" : "en-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(savedAt));
}
