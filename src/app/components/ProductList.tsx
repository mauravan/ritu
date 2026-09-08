"use client";

import type { RankedProduct } from "@/lib/types";

const tagColors: Record<string, string> = {
  "best value": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "best specs": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  cheapest: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  balanced: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "best condition": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
};

export default function ProductList({ products }: { products: RankedProduct[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-zinc-500">No products found — try a different description.</p>;
  }

  const total = products.length;
  const display = products.slice(0, 40);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Ranked Products ({display.length}{total > 40 ? ` of ${total}` : ""})</h3>
      {total > 40 && <p className="text-xs text-zinc-500">Showing top 40 of {total}</p>}
      <div className="grid gap-4">
        {display.map((p, idx) => (
          <div key={`${p.marketplace}-${p.id}`} className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4 flex gap-4">
            <div className="shrink-0">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} className="h-20 w-20 object-cover rounded" />
              ) : (
                <div className="h-20 w-20 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">No image</div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline line-clamp-2">
                  #{idx + 1} {p.title}
                </a>
                <span className="shrink-0 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">{p.marketplace}</span>
              </div>
              <div className="text-sm">
                {p.priceChf !== null ? <span className="font-semibold">CHF {p.priceChf}</span> : <span className="text-zinc-500">Price unavailable</span>}
                {p.condition && <span className="ml-2 text-xs text-zinc-500">{p.condition}</span>}
                {p.location && <span className="ml-2 text-xs text-zinc-500">{p.location}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.tags.map((t) => (
                  <span key={t} className={`rounded-full px-2 py-1 text-xs font-medium ${tagColors[t] ?? "bg-zinc-100"}`}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-20">Spec</span>
                  <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-2 rounded bg-purple-500" style={{ width: `${p.specScore}%` }} />
                  </div>
                  <span className="w-8 text-right">{p.specScore}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-20">Value</span>
                  <div className="flex-1 h-2 rounded bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-2 rounded bg-green-500" style={{ width: `${p.valueScore}%` }} />
                  </div>
                  <span className="w-8 text-right">{p.valueScore}</span>
                </div>
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
              {p.reasons.length > 0 && <ul className="list-disc list-inside text-xs text-zinc-500">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
