"use client";

import { useMemo, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import { sortProducts } from "@/lib/sort";
import type { DerivedSpec, Platform, SearchResult, SortBy, SortDir } from "@/lib/types";
import ProductList from "./ProductList";
import QueryList from "./QueryList";
import SearchForm from "./SearchForm";
import SpecPanel from "./SpecPanel";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

export default function SearchView() {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  const [result, setResult] = useState<SearchResult | null>(null);
  const [derivedSpec, setDerivedSpec] = useState<DerivedSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("hybrid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [zipCode, setZipCode] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (
    query: string,
    platform: Platform,
    extra?: {
      askQuestion?: boolean;
      clarifyingAnswer?: string;
      clarifyingQuestion?: string;
      originalQuery?: string;
      zipCode?: string;
      radius?: number;
    },
  ): Promise<SearchResult | { clarifyingQuestion: string } | undefined> => {
    console.log(`[RITU][CLIENT] search start query="${query}" platform=${platform}`);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setDerivedSpec(null);
    try {
      if (extra?.askQuestion) {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key":
              globalThis.process?.env?.RITU_API_KEY ??
              process?.env?.RITU_API_KEY ??
              "dummy-key-123",
          },
          body: JSON.stringify({
            query,
            platform,
            locale,
            askQuestion: true,
            clarifyingAnswer: extra?.clarifyingAnswer,
            clarifyingQuestion: extra?.clarifyingQuestion,
            originalQuery: extra?.originalQuery || query,
          }),
        });
        const data = (await res.json()) as SearchResult & {
          error?: string;
          details?: string;
          clarifyingQuestion?: string;
        };
        if (!res.ok) {
          setError(
            data.error ? `${data.error}: ${data.details ?? ""}` : `Search failed: ${res.status}`,
          );
          return undefined;
        }
        if (data.clarifyingQuestion && !data.derivedSpec) {
          return data as { clarifyingQuestion: string };
        }
        setResult(data as SearchResult);
        return data as SearchResult;
      }

      let derivedForFull: DerivedSpec | undefined;
      const deriveRes = await fetch("/api/search/derive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":
            globalThis.process?.env?.RITU_API_KEY ?? process?.env?.RITU_API_KEY ?? "dummy-key-123",
        },
        body: JSON.stringify({
          query,
          platform,
          locale,
          askQuestion: false,
          clarifyingAnswer: extra?.clarifyingAnswer,
          clarifyingQuestion: extra?.clarifyingQuestion,
          originalQuery: extra?.originalQuery || query,
        }),
      });
      if (deriveRes.ok) {
        const deriveData = (await deriveRes.json()) as {
          derivedSpec?: DerivedSpec;
        };
        if (deriveData.derivedSpec) {
          setDerivedSpec(deriveData.derivedSpec);
          derivedForFull = deriveData.derivedSpec;
        }
      } else {
        const errData = (await deriveRes.json()) as {
          error?: string;
          details?: string;
        };
        console.warn(`[RITU][CLIENT] derive failed ${deriveRes.status}`, errData);
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":
            globalThis.process?.env?.RITU_API_KEY ?? process?.env?.RITU_API_KEY ?? "dummy-key-123",
        },
        body: JSON.stringify({
          query,
          platform,
          locale,
          askQuestion: extra?.askQuestion ?? false,
          clarifyingAnswer: extra?.clarifyingAnswer,
          clarifyingQuestion: extra?.clarifyingQuestion,
          originalQuery: extra?.originalQuery || query,
          derivedSpec: derivedForFull ?? undefined,
          zipCode: extra?.zipCode,
          radius: extra?.radius,
        }),
      });
      console.log(`[RITU][CLIENT] response status=${res.status}`);
      const data = (await res.json()) as SearchResult & {
        error?: string;
        details?: string;
        clarifyingQuestion?: string;
      };
      if (!res.ok) {
        console.warn(`[RITU][CLIENT] search failed ${res.status}`, data);
        setError(
          data.error ? `${data.error}: ${data.details ?? ""}` : `Search failed: ${res.status}`,
        );
        return undefined;
      }
      if (data.clarifyingQuestion && !data.derivedSpec) {
        console.log(`[RITU][CLIENT] clarifying response received; handled by SearchForm`);
        return data as { clarifyingQuestion: string };
      }
      console.log(
        `[RITU][CLIENT] result queries=${data.queries?.length ?? 0} products=${(data as SearchResult).products?.length ?? 0} spec=${(data as SearchResult).derivedSpec?.category}`,
      );
      (data as SearchResult).products?.slice(0, 3).forEach((p, i) => {
        console.log(
          `[RITU][CLIENT] product #${i} title="${p.title.slice(0, 60)}" spec=${p.specScore} img=${p.imageUrl?.slice(0, 80) ?? "null"}`,
        );
      });
      setResult(data as SearchResult);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return data as SearchResult;
    } catch (e) {
      console.error(`[RITU][CLIENT] search error`, e);
      setError(String(e));
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };
  const sorted = useMemo(
    () => sortProducts(result?.products ?? [], sortBy, sortDir),
    [result, sortBy, sortDir],
  );

  return (
    <div className="space-y-6">
      <SearchForm
        onSearch={handleSearch}
        isLoading={isLoading}
        error={error}
        zipCode={zipCode}
        onZipCodeChange={setZipCode}
      />

      {(derivedSpec || result) && (
        <div ref={resultsRef} className="space-y-6">
          {derivedSpec && !result && <SpecPanel spec={derivedSpec} />}

          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-[304px_1fr] gap-6 items-start">
              {/* Left on desktop, below products in DOM/mobile if needed or handled via CSS grid order */}
              {/* Plan: "Use CSS grid placement so desktop trace appears left while DOM/mobile order keeps products first." */}
              <div className="lg:col-start-2 lg:row-start-1">
                <ProductList
                  products={sorted}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortChange={(b, d) => {
                    setSortBy(b);
                    setSortDir(d);
                  }}
                />
                {result.products.length === 0 && (
                  <div className="mt-4 p-3 border border-border bg-panel rounded-[2px]">
                    <p className="text-xs text-marketplace-accent">
                      {dict.no_products_found_message}
                    </p>
                  </div>
                )}
              </div>

              <div className="lg:col-start-1 lg:row-start-1 space-y-4">
                <div className="border border-border bg-panel rounded-[2px] p-3 space-y-3">
                  <div className="text-xs font-medium text-text-secondary">
                    <span className="pane-legend">{dict.pane_search_trace}</span>
                  </div>

                  <div className="border border-border rounded-[2px] p-2 bg-canvas">
                    <p className="text-xs">
                      <span className="text-text-secondary">{dict.query_label}</span>{" "}
                      <span className="text-text-primary font-medium">
                        &ldquo;{result.input}&rdquo;
                      </span>
                    </p>
                  </div>

                  {(result.clarifyingQuestion || result.clarifyingAnswer) && (
                    <div className="rounded-[2px] border border-border bg-canvas p-2 text-xs space-y-1">
                      <p className="font-semibold text-text-primary">
                        {dict.clarifying_context_heading}
                      </p>
                      {result.clarifyingQuestion && (
                        <p className="text-text-secondary">
                          {dict.clarifying_context_q.replace(
                            "{question}",
                            result.clarifyingQuestion,
                          )}
                        </p>
                      )}
                      {result.clarifyingAnswer && (
                        <p className="text-text-primary">
                          {dict.clarifying_context_answer.replace(
                            "{answer}",
                            result.clarifyingAnswer,
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  <SpecPanel spec={result.derivedSpec} />

                  <QueryList queries={result.queries} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
