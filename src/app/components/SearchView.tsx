"use client";

import { useMemo, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import { sortProducts } from "@/lib/sort";
import type { Platform, SearchResult, SortBy, SortDir } from "@/lib/types";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("hybrid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [zipCode, setZipCode] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (
    query: string,
    platform: Platform,
    extra?: { zipCode?: string; radius?: number; askedQuestions?: string[] },
  ): Promise<SearchResult | { clarifyingQuestion: string } | undefined> => {
    setIsLoading(true);
    setError(null);
    try {
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
          askedQuestions: extra?.askedQuestions ?? [],
          zipCode: extra?.zipCode,
          radius: extra?.radius,
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
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return data as SearchResult;
    } catch (e) {
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

      {result && (
        <div ref={resultsRef} className="space-y-6">
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
