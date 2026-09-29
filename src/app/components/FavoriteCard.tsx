"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type en from "@/dictionaries/en.json";
import { type FavoriteItem, formatSavedAt } from "@/lib/favorites";
import type { Locale } from "@/lib/types";

type Props = {
  item: FavoriteItem;
  onRemove: (favoriteId: string) => void;
  onUpdateNote: (favoriteId: string, note: string) => void;
  dict: typeof en;
  locale: Locale;
};

function priceText(l: FavoriteItem["listing"], dict: typeof en): string {
  if (l.marketplace === "ricardo" && (l.bidPriceChf != null || l.listedPriceChf != null)) {
    const bid = l.bidPriceChf != null ? `CHF ${l.bidPriceChf} ${dict.bid_word}` : null;
    const listed = l.listedPriceChf != null ? `CHF ${l.listedPriceChf} ${dict.listed_word}` : null;
    return [bid, listed].filter(Boolean).join(" · ");
  }
  if (l.priceChf !== null) return `CHF ${l.priceChf}`;
  return String(dict.price_unavailable);
}

export default function FavoriteCard({ item, onRemove, onUpdateNote, dict, locale }: Props) {
  const l = item.listing;
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNote) noteInputRef.current?.focus();
  }, [editingNote]);

  const commit = () => {
    onUpdateNote(item.id, noteDraft);
    setEditingNote(false);
  };

  return (
    <article className="p-3 flex gap-3 border-b border-border last:border-b-0">
      <a href={l.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
        {l.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: external marketplace thumbnails need plain <img>; next/image requires remotePatterns per host.
          <img
            src={l.imageUrl}
            alt={l.title}
            width={56}
            height={56}
            loading="lazy"
            className="rounded-[2px] border border-border object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-[2px] border border-border bg-canvas flex items-center justify-center text-text-secondary text-[10px]">
            {String(dict.no_image)}
          </div>
        )}
      </a>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:underline line-clamp-2 text-text-primary min-w-0"
          >
            {l.title}
          </a>
          <button
            type="button"
            aria-label={String(dict.favorite_remove)}
            title={String(dict.favorite_remove)}
            onClick={() => onRemove(item.id)}
            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-[2px] border border-border bg-canvas text-interface-accent hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <Star className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true" />
          </button>
        </div>
        <div className="text-xs">
          <span className="font-semibold text-marketplace-accent">{priceText(l, dict)}</span>
          <span className="text-text-secondary"> · {l.marketplace}</span>
        </div>
        <div className="text-[11px] text-text-secondary tabular-nums">
          {String(dict.favorite_saved_prefix)}{" "}
          {formatSavedAt(item.savedAt, locale, String(dict.favorite_saved_just_now))}
        </div>
        {editingNote ? (
          <input
            ref={noteInputRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setNoteDraft(item.note);
                setEditingNote(false);
              }
            }}
            maxLength={200}
            placeholder={String(dict.favorite_note_placeholder)}
            aria-label={String(dict.favorite_note_label)}
            autoComplete="off"
            className="w-full px-2 py-1 text-xs rounded-[2px] border border-border bg-canvas text-text-primary placeholder:text-text-secondary"
          />
        ) : item.note ? (
          <button
            type="button"
            onClick={() => {
              setNoteDraft(item.note);
              setEditingNote(true);
            }}
            className="text-xs text-text-secondary hover:text-text-primary cursor-pointer text-left break-words w-full"
            title={String(dict.favorite_edit_note)}
          >
            {item.note}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNoteDraft("");
              setEditingNote(true);
            }}
            className="text-[11px] text-text-secondary hover:text-interface-accent cursor-pointer bracket-tag"
          >
            {String(dict.favorite_add_note)}
          </button>
        )}
      </div>
    </article>
  );
}
