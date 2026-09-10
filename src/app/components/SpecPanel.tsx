"use client";

import type { DerivedSpec } from "@/lib/types";

export default function SpecPanel({ spec }: { spec: DerivedSpec }) {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-6 space-y-4">
      <h2 className="text-lg font-semibold">{spec.category}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{spec.summary}</p>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Requirements</h3>
        <div className="flex flex-wrap gap-2">
          {spec.requirements.map((r) => (
            <span
              key={`${r.key}-${r.value}`}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                r.importance === "required"
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {r.key}: {r.value} <span className="opacity-60">{r.importance}</span>
            </span>
          ))}
        </div>
      </div>
      {spec.excludedTerms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {spec.excludedTerms.map((t) => (
            <span
              key={t}
              title="Products containing these terms are penalized or filtered"
              className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-500"
            >
              -{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
