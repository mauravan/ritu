"use client";

import Image from "next/image";
import { memo, useMemo } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import type { RankedProduct, SortBy, SortDir, Tag } from "@/lib/types";
import ListingDescription from "./ListingDescription";
import SortSelect from "./SortSelect";
import Tooltip from "./Tooltip";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

/*
Plan mapping:
Map `best specs` to `score-spec`, `best value` to `score-value`,
`cheapest` and `best condition` to trade amber, `balanced` to `score-hybrid`,
and `best overall` to `score-overall`.
Render tags as square bracketed labels using the mapped text color and a 1px border; do not use filled pills.
*/
const tagClassMap: Record<string, string> = {
  "best specs": "text-score-spec border-score-spec",
  "best value": "text-score-value border-score-value",
  cheapest: "text-marketplace-accent border-marketplace-accent",
  "best condition": "text-marketplace-accent border-marketplace-accent",
  balanced: "text-score-hybrid border-score-hybrid",
  "best overall": "text-score-overall border-score-overall",
};
const tagTooltipMap: Record<Tag, { titleKey: string; textKey: string }> = {
  "best specs": {
    titleKey: "tooltip_tag_best_specs_title",
    textKey: "tooltip_tag_best_specs_text",
  },
  "best value": {
    titleKey: "tooltip_tag_best_value_title",
    textKey: "tooltip_tag_best_value_text",
  },
  cheapest: { titleKey: "tooltip_tag_cheapest_title", textKey: "tooltip_tag_cheapest_text" },
  "best condition": {
    titleKey: "tooltip_tag_best_condition_title",
    textKey: "tooltip_tag_best_condition_text",
  },
  balanced: { titleKey: "tooltip_tag_balanced_title", textKey: "tooltip_tag_balanced_text" },
  "best overall": {
    titleKey: "tooltip_tag_best_overall_title",
    textKey: "tooltip_tag_best_overall_text",
  },
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
  hasHybrid,
  hasRelevance,
  dict,
}: DerivedItem & { dict: typeof en }) {
  const zeroIndex = String(idx + 1).padStart(3, "0");
  const sourceLabel = String(dict.source_label ?? "source");

  return (
    <article
      key={`${p.marketplace}-${p.id}`}
      className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 border-b border-border last:border-b-0"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 180px" }}
    >
      <div className="shrink-0">
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.title}
            width={128}
            height={128}
            className="h-24 w-24 md:h-32 md:w-32 object-cover rounded-[2px] bg-canvas border border-border"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="h-24 w-24 md:h-32 md:w-32 rounded-[2px] bg-canvas border border-border items-center justify-center text-xs text-text-secondary"
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
            className="font-medium text-xs sm:text-sm hover:underline line-clamp-2 text-text-primary"
          >
            <span className="text-text-secondary font-mono mr-1">[{zeroIndex}]</span>
            {p.title}
          </a>
          <span className="shrink-0 text-xs rounded-[2px] border border-border bg-canvas px-1.5 py-0.5 text-text-secondary">
            {sourceLabel}: <span className="text-text-primary font-medium">{p.marketplace}</span>
          </span>
        </div>

        <div className="text-xs sm:text-sm flex flex-wrap items-baseline gap-2">
          {p.marketplace === "ricardo" && (p.bidPriceChf != null || p.listedPriceChf != null) ? (
            <span className="font-semibold text-marketplace-accent text-base sm:text-lg">
              {p.bidPriceChf != null ? `CHF ${p.bidPriceChf} ${dict.bid_word}` : null}
              {p.bidPriceChf != null && p.listedPriceChf != null ? " · " : null}
              {p.listedPriceChf != null ? `CHF ${p.listedPriceChf} ${dict.listed_word}` : null}
            </span>
          ) : p.priceChf !== null ? (
            <span className="font-semibold text-marketplace-accent text-base sm:text-lg">
              CHF {p.priceChf}
            </span>
          ) : (
            <span className="text-text-secondary">{dict.price_unavailable}</span>
          )}
          {p.condition && (
            <span className="text-xs text-text-secondary">
              {dict.condition_prefix} {p.condition}
            </span>
          )}
          {p.location && <span className="text-xs text-text-secondary">{p.location}</span>}
        </div>

        {p.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {p.tags.map((t) => {
              const customClass = tagClassMap[t] ?? "text-text-secondary border-border";
              return (
                <span
                  key={t}
                  className={`bracket-tag inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-[2px] border bg-canvas ${customClass}`}
                >
                  {t}
                  <Tooltip
                    {...tagTooltipMap[t as Tag]}
                    buttonClass="ml-1 inline-flex items-center justify-center text-[10px] text-text-secondary hover:text-text-primary"
                  />
                </span>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-text-secondary">
              {dict.spec_label}
              <Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />
            </span>
            <div className="flex-1 h-2 rounded-[2px] bg-canvas border border-border overflow-hidden">
              <div
                className="h-full bg-score-spec score-track-ticks"
                style={{ width: `${p.specScore}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-text-primary">{p.specScore}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-text-secondary">
              {dict.value_label}
              <Tooltip titleKey="tooltip_value_title" textKey="tooltip_value_text" />
            </span>
            <div className="flex-1 h-2 rounded-[2px] bg-canvas border border-border overflow-hidden">
              <div
                className="h-full bg-score-value score-track-ticks"
                style={{ width: `${p.valueScore}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-text-primary">{p.valueScore}</span>
          </div>

          {hasRelevance && (
            <div
              className="flex items-center gap-2 text-xs"
              title="LLM relevance 0-100; <30 filtered as irrelevant"
            >
              <span className="w-24 shrink-0 text-text-secondary">
                {dict.ai_relevance_label}
                <Tooltip titleKey="tooltip_ai_title" textKey="tooltip_ai_text" />
              </span>
              <div className="flex-1 h-2 rounded-[2px] bg-canvas border border-border overflow-hidden">
                <div
                  className="h-full bg-score-ai score-track-ticks"
                  style={{ width: `${p.relevance}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-text-primary">{p.relevance}</span>
            </div>
          )}

          {hasHybrid && (
            <div className="flex items-center gap-2 text-xs" title="0.55×spec + 0.45×AI">
              <span className="w-24 shrink-0 text-text-secondary">
                {dict.hybrid_label}
                <Tooltip titleKey="tooltip_hybrid_title" textKey="tooltip_hybrid_text" />
              </span>
              <div className="flex-1 h-2 rounded-[2px] bg-canvas border border-border overflow-hidden">
                <div
                  className="h-full bg-score-hybrid score-track-ticks"
                  style={{ width: `${p.hybridScore}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-text-primary">{p.hybridScore}</span>
            </div>
          )}
        </div>

        {p.matchedRequirements.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {p.matchedRequirements.map((m) => (
              <span
                key={m}
                className="bracket-tag rounded-[2px] bg-canvas border border-border px-1.5 py-0.5 text-[11px] text-text-secondary"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {p.reasons.length > 0 && (
          <ul className="text-xs text-text-secondary space-y-0.5 pt-1">
            {p.reasons.map((r) => (
              <li key={r} className="flex items-start gap-1.5">
                <span className="text-interface-accent select-none" aria-hidden="true">
                  &gt;
                </span>
                <span>{translateReason(r, dict)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-1">
          <ListingDescription marketplace={p.marketplace} id={p.id} />
        </div>
      </div>
    </article>
  );
});

export default function ProductList({
  products,
  sortBy,
  sortDir,
  onSortChange,
}: {
  products: RankedProduct[];
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (by: SortBy, dir: SortDir) => void;
}) {
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
    return <p className="text-xs text-text-secondary">{dict.no_products_found_message}</p>;
  }

  const resultsPaneLabel = String(dict.pane_results ?? "results");
  const countLabel =
    total > 40
      ? `01–${String(display.length).padStart(2, "0")} / ${total}`
      : `01–${String(display.length).padStart(2, "0")}`;

  return (
    <div className="border border-border bg-panel rounded-[2px] overflow-hidden">
      <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-text-secondary bg-panel">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pane-legend">
            {resultsPaneLabel} {countLabel}
          </span>
          <SortSelect
            by={sortBy}
            dir={sortDir}
            onChange={onSortChange}
            dict={dict as Record<string, unknown>}
          />
        </div>
        <div className="text-right">
          <span className="text-[11px] block text-text-primary">
            {dict.ranked_products_heading}
          </span>
          {total > 40 && (
            <span className="text-[10px] text-text-secondary block">
              {dict.showing_top_40.replace("{total}", String(total))}
            </span>
          )}
        </div>
      </div>

      <div>
        {mapped.map((item) => (
          <ProductItem key={`${item.p.marketplace}-${item.p.id}`} {...item} dict={dict} />
        ))}
      </div>
    </div>
  );
}
