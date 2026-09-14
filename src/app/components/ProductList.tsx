"use client";

import { memo, useMemo } from "react";
import { tagExplanation } from "@/lib/ranking";
import type { RankedProduct } from "@/lib/types";
import ListingDescription from "./ListingDescription";
import Tooltip from "./Tooltip";
import useLocale from "./useLocale";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";

const dictionaries = { de, en } as const;

const tagColors: Record<string, string> = {
  "best value": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "best specs": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  cheapest: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  balanced: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "best overall": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
};

type DerivedItem = {
  p: RankedProduct;
  idx: number;
  total: number;
  hasHybrid: boolean;
  hasRelevance: boolean;
};

function translateReason(r: string, dict: typeof en): string {
  if (r.startsWith("Matches:")) return r.replace("Matches:", dict.matches_prefix);
  if (r.startsWith("Price CHF")) return r.replace("Price CHF", dict.price_chf_prefix);
  if (r.startsWith("Condition:")) return r.replace("Condition:", dict.condition_prefix);
  if (r.startsWith("LLM:")) return r.replace("LLM:", dict.llm_prefix);
  return r;
}

const ProductItem = memo(function ProductItem({
  p,
  idx,
  total,
  hasHybrid,
  hasRelevance,
  dict,
}: DerivedItem & { dict: typeof en }) {
  return (
    <div
      key={`${p.marketplace}-${p.id}`}
      className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4 flex gap-4"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 160px" }}
    >
      <div className="shrink-0">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.title}
            className="h-20 w-20 object-cover rounded bg-zinc-100"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="h-20 w-20 rounded bg-zinc-100 dark:bg-zinc-800 items-center justify-center text-xs text-zinc-400"
          style={{ display: p.imageUrl ? "none" : "flex" }}
        >
          {dict.no_image}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:underline line-clamp-2"
          >
            #{idx + 1} {p.title}
          </a>
          <span className="shrink-0 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">
            {p.marketplace}
          </span>
        </div>
        <div className="text-sm">
          {p.marketplace === "ricardo" && (p.bidPriceChf != null || p.listedPriceChf != null) ? (
            <span className="font-semibold">
              {p.bidPriceChf != null ? `CHF ${p.bidPriceChf} ${dict.bid_word}` : null}
              {p.bidPriceChf != null && p.listedPriceChf != null ? " · " : null}
              {p.listedPriceChf != null ? `CHF ${p.listedPriceChf} ${dict.listed_word}` : null}
            </span>
          ) : p.priceChf !== null ? (
            <span className="font-semibold">CHF {p.priceChf}</span>
          ) : (
            <span className="text-zinc-500">{dict.price_unavailable}</span>
          )}
          {p.condition && <span className="ml-2 text-xs text-zinc-500">{p.condition}</span>}
          {p.location && <span className="ml-2 text-xs text-zinc-500">{p.location}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {p.tags.map((t) => {
            const tagBtnColors: Record<string, string> = {
              "best value": "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100",
              "best specs": "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-100",
              cheapest: "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
              balanced: "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
              "best overall": "bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100",
            };
            return (
              <span
                key={t}
                className={`rounded-full px-2 py-1 text-xs font-medium ${tagColors[t] ?? "bg-zinc-100"}`}
              >
                {t}
                <Tooltip
                  titleKey="tooltip_tag_title"
                  content={<span>{tagExplanation(t)}</span>}
                  buttonClass={`ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] leading-none focus:outline-none focus:ring-2 ${tagBtnColors[t] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"}`}
                />
              </span>
            );
          })}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0">
              {dict.spec_label}
              <Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />
            </span>
            <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
              <div className="h-2 rounded bg-purple-500" style={{ width: `${p.specScore}%` }} />
            </div>
            <span className="w-8 text-right">{p.specScore}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0">
              {dict.value_label}
              <Tooltip titleKey="tooltip_value_title" textKey="tooltip_value_text" />
            </span>
            <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
              <div className="h-2 rounded bg-green-500" style={{ width: `${p.valueScore}%` }} />
            </div>
            <span className="w-8 text-right">{p.valueScore}</span>
          </div>
          {hasRelevance && (
            <div
              className="flex items-center gap-2 text-xs"
              title="LLM relevance 0-100; <30 filtered as irrelevant"
            >
              <span className="w-24 shrink-0">
                {dict.ai_relevance_label}
                <Tooltip titleKey="tooltip_ai_title" textKey="tooltip_ai_text" />
              </span>
              <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                <div className="h-2 rounded bg-amber-500" style={{ width: `${p.relevance}%` }} />
              </div>
              <span className="w-8 text-right">{p.relevance}</span>
            </div>
          )}
          {hasHybrid && (
            <div className="flex items-center gap-2 text-xs" title="0.55×spec + 0.45×AI">
              <span className="w-24 shrink-0">
                {dict.hybrid_label}
                <Tooltip titleKey="tooltip_hybrid_title" textKey="tooltip_hybrid_text" />
              </span>
              <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                <div className="h-2 rounded bg-indigo-500" style={{ width: `${p.hybridScore}%` }} />
              </div>
              <span className="w-8 text-right">{p.hybridScore}</span>
            </div>
          )}
        </div>
        {p.matchedRequirements.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.matchedRequirements.map((m) => (
              <span key={m} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs">
                {m}
              </span>
            ))}
          </div>
        )}
        {p.reasons.length > 0 && (
          <ul className="list-disc list-inside text-xs text-zinc-500">
            {p.reasons.map((r) => (
              <li key={r}>{translateReason(r, dict)}</li>
            ))}
          </ul>
        )}
        <ListingDescription marketplace={p.marketplace} id={p.id} />
      </div>
    </div>
  );
});

export default function ProductList({ products }: { products: RankedProduct[] }) {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;

  const total = products.length;
  const display = useMemo(() => (total === 0 ? [] : products.slice(0, 40)), [products, total]);

  const mapped = useMemo(() => {
    return display.map((p, idx) => {
      return {
        p,
        idx,
        total,
        hasHybrid: p.hybridScore !== undefined,
        hasRelevance: p.relevance !== undefined,
      } as DerivedItem;
    });
  }, [display, total]);

  if (total === 0) {
    return <p className="text-sm text-zinc-500">{dict.no_products_found_message}</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        {dict.ranked_products_heading} ({display.length}
        {total > 40 ? ` of ${total}` : ""})
      </h3>
      {total > 40 && (
        <p className="text-xs text-zinc-500">
          {dict.showing_top_40.replace("{total}", String(total))}
        </p>
      )}
      <div className="grid gap-4">
        {mapped.map((item) => (
          <ProductItem key={`${item.p.marketplace}-${item.p.id}`} {...item} dict={dict} />
        ))}
      </div>
    </div>
  );
}
