"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type en from "@/dictionaries/en.json";
import type { FavoriteListing } from "@/lib/favorites";

type Props = {
  listing: FavoriteListing;
  favoriteId: string | null; // null = not favorited
  categories: string[];
  onAdd: (listing: FavoriteListing, category: string) => void;
  onRemove: (favoriteId: string) => void;
  dict: typeof en; // from ProductItem
};

export default function FavoriteButton({
  listing,
  favoriteId,
  categories,
  onAdd,
  onRemove,
  dict,
}: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstCatRef = useRef<HTMLButtonElement>(null);

  // Focus on open: first category, else the new-name input.
  useEffect(() => {
    if (!open) return;
    if (categories.length > 0) {
      firstCatRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [open, categories.length]);

  // Outside-click close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-pressed={favoriteId !== null}
        aria-label={favoriteId ? String(dict.favorite_remove) : String(dict.favorite_save)}
        title={favoriteId ? String(dict.favorite_remove) : String(dict.favorite_save)}
        onClick={() => {
          if (favoriteId) {
            onRemove(favoriteId);
          } else {
            setOpen((o) => !o);
          }
        }}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-[2px] border transition-colors cursor-pointer ${
          favoriteId
            ? "border-interface-accent bg-canvas text-interface-accent"
            : "border-border bg-canvas text-text-secondary hover:text-interface-accent hover:border-interface-accent"
        }`}
      >
        <Star
          className="w-3.5 h-3.5"
          fill={favoriteId ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </button>

      {open && favoriteId === null && (
        <div
          role="dialog"
          aria-label={String(dict.favorite_pick_category)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          className="absolute right-0 top-full mt-1 z-30 w-60 border border-border bg-panel rounded-[2px] p-2 space-y-2"
        >
          <div className="text-[11px] text-text-secondary">
            <span className="pane-legend">{String(dict.favorite_pick_category)}</span>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  ref={c === categories[0] ? firstCatRef : undefined}
                  onClick={() => {
                    onAdd(listing, c);
                    setOpen(false);
                  }}
                  className="bracket-tag px-2 py-1 text-xs rounded-[2px] border bg-panel text-text-secondary border-border hover:bg-surface-subtle hover:text-text-primary cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (!n) return;
              onAdd(listing, n);
              setNewName("");
              setOpen(false);
            }}
          >
            <label className="sr-only" htmlFor={`fav-cat-${listing.marketplace}-${listing.id}`}>
              {String(dict.favorite_category_input_label)}
            </label>
            <input
              id={`fav-cat-${listing.marketplace}-${listing.id}`}
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder={String(dict.favorite_category_placeholder)}
              autoComplete="off"
              className="w-full px-2 py-1 text-xs rounded-[2px] border border-border bg-canvas text-text-primary placeholder:text-text-secondary"
            />
          </form>
        </div>
      )}
    </div>
  );
}
