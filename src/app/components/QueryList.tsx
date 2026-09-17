"use client";

import { useMemo } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import type { MarketplaceQuery } from "@/lib/types";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

export default function QueryList({ queries }: { queries: MarketplaceQuery[] }) {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  const ricardo = useMemo(() => queries.filter((q) => q.marketplace === "ricardo"), [queries]);
  const tutti = useMemo(() => queries.filter((q) => q.marketplace === "tutti"), [queries]);

  const renderGroup = (label: string, items: MarketplaceQuery[]) => (
    <div
      className="space-y-1.5"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 60px" }}
    >
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span className="font-medium text-text-primary">&gt; {label}</span>
        <span className="text-[11px]">
          {dict.queries_count.replace("{count}", String(items.length))}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((q) => (
          <a
            key={`${q.marketplace}-${q.query}`}
            href={q.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bracket-tag inline-flex items-center gap-1 rounded-[2px] border border-border bg-panel px-2 py-0.5 text-xs text-text-primary hover:bg-surface-subtle transition-colors"
          >
            <span>{q.query}</span>
            <span className="text-text-secondary text-[10px]" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div className="border border-border bg-canvas rounded-[2px] p-3 space-y-3">
      <div className="border-b border-border pb-1.5">
        <h3 className="text-xs font-semibold text-text-primary">
          {dict.marketplace_queries_heading}
        </h3>
      </div>
      {renderGroup("ricardo", ricardo)}
      {renderGroup("tutti", tutti)}
    </div>
  );
}
