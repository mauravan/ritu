"use client";

import { ChevronLeft } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import { sortProducts } from "@/lib/sort";
import type { Platform, SearchResult, SortBy, SortDir } from "@/lib/types";
import FavoritesPane from "./FavoritesPane";
import PaneRail from "./PaneRail";
import ProductList from "./ProductList";
import QueryList from "./QueryList";
import SearchForm from "./SearchForm";
import SpecPanel from "./SpecPanel";
import useFavorites from "./useFavorites";
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
  const [mobileView, setMobileView] = useState<"search" | "favorites">("search");
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [favCollapsed, setFavCollapsed] = useState(false);
  const fav = useFavorites();
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

      {/* Mobile switch — lg:hidden, sits under SearchForm */}
      <div className="lg:hidden flex items-center border border-border rounded-[2px] bg-panel p-0.5">
        <button
          type="button"
          aria-pressed={mobileView === "search"}
          onClick={() => setMobileView("search")}
          className={`flex-1 px-2 py-1 rounded-[2px] transition-colors cursor-pointer text-xs ${mobileView === "search" ? "bg-selection text-on-selection font-medium" : "text-text-secondary hover:text-text-primary"}`}
        >
          {String(dict.favorite_switch_search)}
        </button>
        <button
          type="button"
          aria-pressed={mobileView === "favorites"}
          onClick={() => setMobileView("favorites")}
          className={`flex-1 px-2 py-1 rounded-[2px] transition-colors cursor-pointer text-xs ${mobileView === "favorites" ? "bg-selection text-on-selection font-medium" : "text-text-secondary hover:text-text-primary"}`}
        >
          {String(dict.favorite_switch_favorites)}{" "}
          <span className="tabular-nums">({fav.count})</span>
        </button>
      </div>

      {result ? (
        <div
          ref={resultsRef}
          className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-6 items-start"
        >
          {/* products */}
          <div
            className={`lg:col-start-2 lg:row-start-1 ${mobileView === "favorites" ? "hidden lg:block" : ""}`}
          >
            <ProductList
              products={sorted}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={(b, d) => {
                setSortBy(b);
                setSortDir(d);
              }}
              specScoringSource={result.specScoringSource}
              favoriteLookup={fav.lookup}
              categories={fav.categories}
              onAddFavorite={fav.addItem}
              onRemoveFavorite={fav.removeItem}
            />
            {result.products.length === 0 && (
              <div className="mt-4 p-3 border border-border bg-panel rounded-[2px]">
                <p className="text-xs text-marketplace-accent">{dict.no_products_found_message}</p>
              </div>
            )}
          </div>

          {/* search trace */}
          <div
            className={`lg:col-start-1 lg:row-start-1 ${traceCollapsed ? "lg:w-9 lg:self-stretch" : "lg:w-[304px]"} ${mobileView === "favorites" ? "hidden lg:block" : ""}`}
          >
            {/* collapsed rail (lg only) */}
            <div className={traceCollapsed ? "hidden lg:block" : "hidden"}>
              <PaneRail
                side="left"
                label={String(dict.pane_search_trace)}
                expandLabel={`${String(dict.pane_expand)} ${String(dict.pane_search_trace)}`}
                onExpand={() => setTraceCollapsed(false)}
              />
            </div>
            {/* pane content */}
            <div className={`space-y-4 ${traceCollapsed ? "lg:hidden" : ""}`}>
              <div className="border border-border bg-panel rounded-[2px] p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-text-secondary">
                  <span className="pane-legend">{dict.pane_search_trace}</span>
                  <button
                    type="button"
                    aria-expanded={true}
                    aria-label={`${String(dict.pane_collapse)} ${String(dict.pane_search_trace)}`}
                    title={`${String(dict.pane_collapse)} ${String(dict.pane_search_trace)}`}
                    onClick={() => setTraceCollapsed(true)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-[2px] border border-border bg-canvas text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
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

          {/* favorites pane */}
          <div
            className={`lg:col-start-3 lg:row-start-1 ${favCollapsed ? "lg:w-9 lg:self-stretch" : "lg:w-[320px]"} ${mobileView === "search" ? "hidden lg:block" : ""}`}
          >
            <div className={favCollapsed ? "hidden lg:block" : "hidden"}>
              <PaneRail
                side="right"
                label={String(dict.pane_favorites)}
                expandLabel={`${String(dict.pane_expand)} ${String(dict.pane_favorites)}`}
                onExpand={() => setFavCollapsed(false)}
              />
            </div>
            <div className={favCollapsed ? "lg:hidden" : ""}>
              <FavoritesPane
                state={fav.state}
                onAddCategory={fav.addCategory}
                onRemoveCategory={fav.removeCategory}
                onRemoveItem={fav.removeItem}
                onUpdateNote={fav.updateNote}
                onCollapse={() => setFavCollapsed(true)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start">
          {/* empty search column (no content pre-search) */}
          <div className={mobileView === "favorites" ? "hidden lg:block" : ""} />
          {/* favorites pane */}
          <div
            className={`lg:col-start-2 ${favCollapsed ? "lg:w-9 lg:self-stretch" : "lg:w-[320px]"} ${mobileView === "search" ? "hidden lg:block" : ""}`}
          >
            <div className={favCollapsed ? "hidden lg:block" : "hidden"}>
              <PaneRail
                side="right"
                label={String(dict.pane_favorites)}
                expandLabel={`${String(dict.pane_expand)} ${String(dict.pane_favorites)}`}
                onExpand={() => setFavCollapsed(false)}
              />
            </div>
            <div className={favCollapsed ? "lg:hidden" : ""}>
              <FavoritesPane
                state={fav.state}
                onAddCategory={fav.addCategory}
                onRemoveCategory={fav.removeCategory}
                onRemoveItem={fav.removeItem}
                onUpdateNote={fav.updateNote}
                onCollapse={() => setFavCollapsed(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
