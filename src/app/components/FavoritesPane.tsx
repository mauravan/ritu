"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import type { FavoritesState } from "@/lib/favorites";
import FavoriteCard from "./FavoriteCard";
import useLocale from "./useLocale";

type Props = {
  state: FavoritesState;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (name: string) => void;
  onRemoveItem: (favoriteId: string) => void;
  onUpdateNote: (favoriteId: string, note: string) => void;
  onCollapse: () => void;
};

const dictionaries = { de, en } as const;

export default function FavoritesPane({
  state,
  onAddCategory,
  onRemoveCategory,
  onRemoveItem,
  onUpdateNote,
  onCollapse,
}: Props) {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const newCategoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingCategory) newCategoryRef.current?.focus();
  }, [addingCategory]);

  const current =
    activeCategory && state.categories.includes(activeCategory)
      ? activeCategory
      : (state.categories[0] ?? null);

  const items = useMemo(
    () => state.items.filter((i) => i.category === current).sort((a, b) => b.savedAt - a.savedAt),
    [state.items, current],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of state.items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
    return m;
  }, [state.items]);

  return (
    <section
      className="border border-border bg-panel rounded-[2px] overflow-hidden"
      aria-label={String(dict.pane_favorites)}
    >
      {/* header */}
      <div className="p-3 border-b border-border flex items-center justify-between gap-2 text-xs font-medium text-text-secondary bg-panel">
        <button
          type="button"
          aria-expanded={true}
          aria-label={`${String(dict.pane_collapse)} ${String(dict.pane_favorites)}`}
          title={`${String(dict.pane_collapse)} ${String(dict.pane_favorites)}`}
          onClick={onCollapse}
          className="inline-flex items-center justify-center w-6 h-6 rounded-[2px] border border-border bg-canvas text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <span className="pane-legend">{String(dict.pane_favorites)}</span>
      </div>

      {/* category selector + add form */}
      <div className="p-3 border-b border-border flex flex-wrap items-center gap-1.5">
        {state.categories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === current}
            onClick={() => setActiveCategory(c)}
            className={`bracket-tag px-2 py-1 text-xs rounded-[2px] border transition-colors cursor-pointer ${
              c === current
                ? "bg-selection text-on-selection border-selection font-medium"
                : "bg-panel text-text-secondary border-border hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {c} <span className="tabular-nums">({counts.get(c) ?? 0})</span>
          </button>
        ))}
        {!addingCategory && (
          <button
            type="button"
            onClick={() => setAddingCategory(true)}
            className="bracket-tag px-2 py-1 text-xs rounded-[2px] border bg-panel text-text-secondary border-border hover:bg-surface-subtle hover:text-text-primary cursor-pointer"
          >
            + {String(dict.favorite_new_category)}
          </button>
        )}
        {addingCategory && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (!n) return;
              onAddCategory(n);
              setNewName("");
              setAddingCategory(false);
              setActiveCategory(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAddingCategory(false);
                setNewName("");
              }
            }}
            className="flex items-center gap-1"
          >
            <label className="sr-only" htmlFor="favorites-new-category">
              {String(dict.favorite_category_input_label)}
            </label>
            <input
              id="favorites-new-category"
              ref={newCategoryRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={40}
              placeholder={String(dict.favorite_category_placeholder)}
              autoComplete="off"
              className="w-32 px-2 py-1 text-xs rounded-[2px] border border-border bg-canvas text-text-primary placeholder:text-text-secondary"
            />
          </form>
        )}
      </div>

      {/* destructive: delete current category */}
      {current && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-error-text">
                {String(dict.favorite_confirm_delete)
                  .replace("{name}", current)
                  .replace("{count}", String(items.length))}
              </span>
              <button
                type="button"
                onClick={() => {
                  onRemoveCategory(current);
                  setConfirmDelete(false);
                  setActiveCategory(null);
                }}
                className="bracket-tag px-2 py-1 text-xs rounded-[2px] border border-error-text text-error-text hover:bg-error-surface cursor-pointer"
              >
                {String(dict.favorite_confirm_yes)}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="bracket-tag px-2 py-1 text-xs rounded-[2px] border border-border text-text-secondary hover:text-text-primary cursor-pointer"
              >
                {String(dict.favorite_confirm_no)}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="bracket-tag px-2 py-1 text-xs rounded-[2px] border border-border text-text-secondary hover:text-error-text hover:border-error-text cursor-pointer"
            >
              {String(dict.favorite_delete_category)}
            </button>
          )}
        </div>
      )}

      {/* item list / empty states */}
      <div>
        {state.categories.length === 0 && (
          <p className="p-4 text-xs text-text-secondary">
            {String(dict.favorite_empty_no_categories)}
          </p>
        )}
        {state.categories.length > 0 && current && items.length === 0 && (
          <p className="p-4 text-xs text-text-secondary">{String(dict.favorite_empty_category)}</p>
        )}
        {current &&
          items.map((it) => (
            <FavoriteCard
              key={it.id}
              item={it}
              onRemove={onRemoveItem}
              onUpdateNote={onUpdateNote}
              dict={dict}
              locale={locale}
            />
          ))}
      </div>
    </section>
  );
}
