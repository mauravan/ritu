"use client";

import { useState, useRef } from "react";
import SearchForm from "./SearchForm";
import SpecPanel from "./SpecPanel";
import QueryList from "./QueryList";
import ProductList from "./ProductList";
import type { SearchResult } from "@/lib/types";

export default function SearchView() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as SearchResult & { error?: string; details?: string };
      if (!res.ok) {
        setError(data.error ? `${data.error}: ${data.details ?? ""}` : `Search failed: ${res.status}`);
        return;
      }
      setResult(data as SearchResult);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <SearchForm onSearch={handleSearch} isLoading={isLoading} error={error} />

      {result && (
        <div ref={resultsRef} className="space-y-6">
          <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4">
            <p className="text-sm">
              <span className="text-zinc-500">Query:</span> <span className="italic">&ldquo;{result.input}&rdquo;</span>
            </p>
            {(result.authUsed.ricardo || result.authUsed.tutti) && (
              <p className="mt-2 text-xs rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 inline-block">
                searched as logged-in user {result.authUsed.ricardo ? "ricardo " : ""} {result.authUsed.tutti ? "tutti" : ""}
              </p>
            )}
            {!result.authUsed.ricardo && !result.authUsed.tutti && result.queries.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">searched anonymously — connect accounts in header for richer results</p>
            )}
          </div>

          <SpecPanel spec={result.derivedSpec} />

          <QueryList queries={result.queries} />

          <ProductList products={result.products} />

          {(result.products.length === 0) && (
            <p className="text-xs text-amber-600">No products found — try a different description.</p>
          )}
        </div>
      )}
    </div>
  );
}
