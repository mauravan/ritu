"use client";

import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import type { DerivedSpec } from "@/lib/types";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

export default function SpecPanel({ spec }: { spec: DerivedSpec }) {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;

  return (
    <div className="border border-border bg-canvas rounded-[2px] p-3 space-y-3">
      <div className="border-b border-border pb-2">
        <h2 className="text-xs sm:text-sm font-semibold text-text-primary tracking-tight">
          &gt; {spec.category}
        </h2>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{spec.summary}</p>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[11px] font-medium text-text-secondary">
          {dict.requirements_heading}:
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {spec.requirements.map((r) => (
            <span
              key={`${r.key}-${r.value}`}
              className={`bracket-tag inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[11px] ${
                r.importance === "required"
                  ? "border-error-text text-error-text bg-error-surface"
                  : "border-border text-text-secondary bg-panel"
              }`}
            >
              <span>{r.key}:</span>
              <span className="text-text-primary font-medium">{r.value}</span>
              <span className="opacity-70 text-[10px]">({r.importance})</span>
            </span>
          ))}
        </div>
      </div>

      {spec.excludedTerms.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          <span className="text-[10px] text-text-secondary block">excluded:</span>
          <div className="flex flex-wrap gap-1.5">
            {spec.excludedTerms.map((t) => (
              <span
                key={t}
                title={dict.excluded_terms_title}
                className="bracket-tag rounded-[2px] border border-border bg-panel px-1.5 py-0.5 text-[11px] text-text-secondary"
              >
                -{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
