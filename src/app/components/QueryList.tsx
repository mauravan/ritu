"use client";

import type { MarketplaceQuery } from "@/lib/types";

export default function QueryList({ queries }: { queries: MarketplaceQuery[] }) {
  const ricardo = queries.filter((q) => q.marketplace === "ricardo");
  const tutti = queries.filter((q) => q.marketplace === "tutti");

  const renderGroup = (label: string, items: MarketplaceQuery[], color: string) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
        <span className="text-xs text-zinc-500">{items.length} queries</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((q) => (
          <a
            key={`${q.marketplace}-${q.query}`}
            href={q.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border bg-white dark:bg-zinc-900 dark:border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {q.query} ↗
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-6 space-y-4">
      <h3 className="text-sm font-semibold">Marketplace Queries</h3>
      {renderGroup("ricardo", ricardo, "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100")}
      {renderGroup("tutti", tutti, "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100")}
    </div>
  );
}
