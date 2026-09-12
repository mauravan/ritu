"use client";

import { useRef, useState } from "react";
import type { DerivedSpec, Platform, SearchResult } from "@/lib/types";
import ProductList from "./ProductList";
import QueryList from "./QueryList";
import SearchForm from "./SearchForm";
import SpecPanel from "./SpecPanel";

export default function SearchView() {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [derivedSpec, setDerivedSpec] = useState<DerivedSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (
    query: string,
    platform: Platform,
    extra?: {
      askQuestion?: boolean;
      clarifyingAnswer?: string;
      clarifyingQuestion?: string;
      originalQuery?: string;
    },
  ): Promise<SearchResult | { clarifyingQuestion: string } | undefined> => {
    console.log(`[RITU][CLIENT] search start query="${query}" platform=${platform}`);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setDerivedSpec(null);
    try {
      // If asking a clarifying question, skip derive; just ask
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

      // Normal / confirmation flow: derive, then full search
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
          askQuestion: false,
          clarifyingAnswer: extra?.clarifyingAnswer,
          clarifyingQuestion: extra?.clarifyingQuestion,
          originalQuery: extra?.originalQuery || query,
        }),
      });
      if (deriveRes.ok) {
        const deriveData = (await deriveRes.json()) as { derivedSpec?: DerivedSpec };
        if (deriveData.derivedSpec) {
          setDerivedSpec(deriveData.derivedSpec);
          derivedForFull = deriveData.derivedSpec;
        }
      } else {
        const errData = (await deriveRes.json()) as { error?: string; details?: string };
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
          askQuestion: extra?.askQuestion ?? false,
          clarifyingAnswer: extra?.clarifyingAnswer,
          clarifyingQuestion: extra?.clarifyingQuestion,
          originalQuery: extra?.originalQuery || query,
          derivedSpec: derivedForFull ?? undefined,
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

  return (
    <div className="space-y-8">
      <SearchForm onSearch={handleSearch} isLoading={isLoading} error={error} />

      {(derivedSpec || result) && (
        <div ref={resultsRef} className="space-y-6">
          {derivedSpec && !result && <SpecPanel spec={derivedSpec} />}

          {result && (
            <>
              <div className="rounded-lg border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-4">
                <p className="text-sm">
                  <span className="text-zinc-500">Query:</span>{" "}
                  <span className="italic">&ldquo;{result.input}&rdquo;</span>
                </p>
              </div>

              {(result.clarifyingQuestion || result.clarifyingAnswer) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-900/20 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Clarifying context
                  </p>
                  {result.clarifyingQuestion && (
                    <p className="text-sm text-zinc-700 dark:text-zinc-200 mt-1">
                      Q: {result.clarifyingQuestion}
                    </p>
                  )}
                  {result.clarifyingAnswer && (
                    <p className="text-sm text-zinc-700 dark:text-zinc-200 mt-1">
                      Your answer: {result.clarifyingAnswer}
                    </p>
                  )}
                </div>
              )}

              <SpecPanel spec={result.derivedSpec} />

              <QueryList queries={result.queries} />

              <ProductList products={result.products} />

              {result.products.length === 0 && (
                <p className="text-xs text-amber-600">
                  No products found — try a different description.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
