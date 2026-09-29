"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  emptyFavorites,
  type FavoriteItem,
  type FavoriteListing,
  type FavoritesState,
  loadFavorites,
  saveFavorites,
} from "@/lib/favorites";

// listing key = `${marketplace}${id}` (unit-separator separator; ids are opaque)
export type FavoriteLookup = Map<string, string>; // listingKey -> favoriteItem.id

export function favoriteListingKey(marketplace: string, id: string): string {
  return `${marketplace}${id}`;
}

export default function useFavorites() {
  // Init empty so the first client render matches SSR HTML; persisted state
  // loads in an effect (localStorage is unreadable during SSR/hydration, and
  // reading it in the useState initializer mismatches the server count).
  const [state, setState] = useState<FavoritesState>(emptyFavorites);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setState(loadFavorites());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveFavorites(state);
  }, [state, hydrated]);

  const lookup = useMemo<FavoriteLookup>(() => {
    const m = new Map<string, string>();
    for (const it of state.items)
      m.set(favoriteListingKey(it.listing.marketplace, it.listing.id), it.id);
    return m;
  }, [state.items]);

  const addItem = useCallback((listing: FavoriteListing, categoryRaw: string) => {
    setState((s) => {
      const key = favoriteListingKey(listing.marketplace, listing.id);
      if (s.items.some((it) => favoriteListingKey(it.listing.marketplace, it.listing.id) === key))
        return s; // idempotent
      const category = categoryRaw.trim();
      if (!category) return s;
      const categories = s.categories.some((c) => c.toLowerCase() === category.toLowerCase())
        ? s.categories
        : [...s.categories, category];
      const item: FavoriteItem = {
        id: crypto.randomUUID(),
        listing,
        category,
        note: "",
        savedAt: Date.now(),
      };
      return { categories, items: [...s.items, item] };
    });
  }, []);

  const removeItem = useCallback((favoriteId: string) => {
    setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== favoriteId) }));
  }, []); // NOTE: does NOT delete now-empty categories; categories are only deleted explicitly

  const updateNote = useCallback((favoriteId: string, note: string) => {
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === favoriteId ? { ...it, note } : it)),
    }));
  }, []);

  const addCategory = useCallback((nameRaw: string) => {
    const name = nameRaw.trim();
    if (!name) return;
    setState((s) =>
      s.categories.some((c) => c.toLowerCase() === name.toLowerCase())
        ? s
        : { ...s, categories: [...s.categories, name] },
    );
  }, []);

  const removeCategory = useCallback((name: string) => {
    setState((s) => ({
      categories: s.categories.filter((c) => c !== name),
      items: s.items.filter((it) => it.category !== name),
    }));
  }, []);

  return {
    state,
    categories: state.categories,
    lookup,
    count: state.items.length,
    addItem,
    removeItem,
    updateNote,
    addCategory,
    removeCategory,
  };
}
