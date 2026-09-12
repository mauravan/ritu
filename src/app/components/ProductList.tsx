"use client";

import { useMemo } from "react";
import { tagExplanation } from "@/lib/ranking";
import type { RankedProduct } from "@/lib/types";
import ListingDescription from "./ListingDescription";

const tagColors: Record<string, string> = {
  "best value": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "best specs": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  cheapest: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  balanced: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "best overall": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
};

export default function ProductList({ products }: { products: RankedProduct[] }) {
  const total = products.length;
  const display = useMemo(() => (total === 0 ? [] : products.slice(0, 40)), [products, total]);

  if (total === 0) {
    return (
      <p className="text-sm text-zinc-500">No products found — try a different description.</p>
    );
  }
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        Ranked Products ({display.length}
        {total > 40 ? ` of ${total}` : ""})
      </h3>
      {total > 40 && <p className="text-xs text-zinc-500">Showing top 40 of {total}</p>}
      <div className="grid gap-4">
        {display.map((p, idx) => {
          const hasHybrid = p.hybridScore !== undefined;
          const hasRelevance = p.relevance !== undefined;
          const breakdown = p.rankingMeta?.breakdown ?? [];
          const hasExcluded = breakdown.some((b) => b.includes("-15 excluded"));
          const displayBreakdown = breakdown.length > 12 ? breakdown.slice(0, 8) : breakdown;

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
                  No image
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
                  {p.marketplace === "ricardo" &&
                  (p.bidPriceChf != null || p.listedPriceChf != null) ? (
                    <span className="font-semibold">
                      {p.bidPriceChf != null ? `CHF ${p.bidPriceChf} bid` : null}
                      {p.bidPriceChf != null && p.listedPriceChf != null ? " · " : null}
                      {p.listedPriceChf != null ? `CHF ${p.listedPriceChf} listed` : null}
                    </span>
                  ) : p.priceChf !== null ? (
                    <span className="font-semibold">CHF {p.priceChf}</span>
                  ) : (
                    <span className="text-zinc-500">Price unavailable</span>
                  )}
                  {p.condition && <span className="ml-2 text-xs text-zinc-500">{p.condition}</span>}
                  {p.location && <span className="ml-2 text-xs text-zinc-500">{p.location}</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${tagColors[t] ?? "bg-zinc-100"}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20">Spec</span>
                    <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded bg-purple-500"
                        style={{ width: `${p.specScore}%` }}
                      />
                    </div>
                    <span className="w-8 text-right">{p.specScore}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20">Value</span>
                    <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded bg-green-500"
                        style={{ width: `${p.valueScore}%` }}
                      />
                    </div>
                    <span className="w-8 text-right">{p.valueScore}</span>
                  </div>
                  {hasRelevance && (
                    <div
                      className="flex items-center gap-2 text-xs"
                      title="LLM relevance 0-100; <30 filtered as irrelevant"
                    >
                      <span className="w-20">AI relevance</span>
                      <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-2 rounded bg-amber-500"
                          style={{ width: `${p.relevance}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{p.relevance}</span>
                    </div>
                  )}
                  {hasHybrid && (
                    <div className="flex items-center gap-2 text-xs" title="0.55×spec + 0.45×AI">
                      <span className="w-20">Hybrid</span>
                      <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-2 rounded bg-indigo-500"
                          style={{ width: `${p.hybridScore}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{p.hybridScore}</span>
                    </div>
                  )}
                </div>
                {p.matchedRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.matchedRequirements.map((m) => (
                      <span
                        key={m}
                        className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {p.reasons.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-zinc-500">
                    {p.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <details className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">{`Why #${idx + 1}?`}</summary>
                  <div className="mt-2 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <p>
                      {`Ranked #${idx + 1} of ${total} — sorted by ${hasHybrid ? "hybridScore (0.55·spec + 0.45·AI) then valueScore" : "valueScore then specScore"}.`}
                    </p>
                    <p>
                      Spec {p.specScore} · Value {p.valueScore}
                      {hasHybrid ? ` · Hybrid ${p.hybridScore}` : ""}
                      {hasRelevance ? ` · AI ${p.relevance}` : ""}
                    </p>
                    {p.llmReason ? (
                      <div className="rounded bg-white dark:bg-zinc-900 p-2 border dark:border-zinc-700">
                        Ranking reason: &quot;{p.llmReason}&quot;
                      </div>
                    ) : !hasRelevance ? (
                      <p>
                        No AI evaluation — outside top 40 or LLM unavailable; ranked
                        deterministically.
                      </p>
                    ) : null}
                    {breakdown.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {displayBreakdown.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No keyword/requirement matches — scored on category/price only.</p>
                    )}
                    {p.rankingMeta?.valueDerivedFrom && (
                      <p className="text-[11px] text-zinc-500">{p.rankingMeta.valueDerivedFrom}</p>
                    )}
                    {p.tags.length > 0 && (
                      <ul className="space-y-0.5">
                        {p.tags.map((t) => (
                          <li key={t}>
                            {t} — {tagExplanation(t)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {hasExcluded && (
                      <p className="rounded bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-800 dark:text-amber-200">
                        Penalty applied for excluded term (e.g. sleeve/hülle) — may have been
                        filtered at lower relevance.
                      </p>
                    )}
                  </div>
                </details>
                <ListingDescription marketplace={p.marketplace} id={p.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
