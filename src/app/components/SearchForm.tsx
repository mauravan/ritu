"use client";

import { useEffect, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import SearchInput from "./SearchInput";
import PlatformSelect from "./PlatformSelect";

const dictionaries = { de, en } as const;

type Locale = "de" | "en";

type SearchResponse = SearchResult | { clarifyingQuestion: string } | undefined;

type Props = {
  onSearch: (
    query: string,
    platform: Platform,
    extra?: {
      askQuestion?: boolean;
      clarifyingAnswer?: string;
      clarifyingQuestion?: string;
      originalQuery?: string;
    },
  ) => Promise<SearchResponse>;
  isLoading: boolean;
  error: string | null;
};

export default function SearchForm({ onSearch, isLoading, error }: Props) {
  const [locale, setLocale] = useState<Locale>("de");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("locale") : null;
    if (stored === "en" || stored === "de") setLocale(stored);
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "en" || detail === "de") setLocale(detail);
    };
    window.addEventListener("locale-change", handleChange);
    return () => window.removeEventListener("locale-change", handleChange);
  }, []);

  const dict = dictionaries[locale] ?? dictionaries.de;

  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform>("both");
  // biome-ignore lint/correctness/noUnusedVariables: expected state variable per clarification flow
  const [askQuestion, setAskQuestion] = useState(false);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [clarifyingQuestion, setClarifyingQuestion] = useState("");
  const [clarifyingAnswer, setClarifyingAnswer] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");

  const runSubmit = async (askQuestionParam = false) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const isConfirmation = awaitingClarification;
    const nextQuery = isConfirmation ? originalQuery : trimmedQuery;
    const opts = isConfirmation
      ? {
          clarifyingAnswer: clarifyingAnswer.trim(),
          clarifyingQuestion: clarifyingQuestion,
          originalQuery: originalQuery,
        }
      : { askQuestion: askQuestionParam };
    setAwaitingClarification(true);
    try {
      const response = await onSearch(nextQuery, platform, opts);
      if (isConfirmation) {
        setAwaitingClarification(false);
        setAskQuestion(false);
        setClarifyingAnswer("");
        setClarifyingQuestion("");
        setOriginalQuery("");
        return;
      }
      if (
        askQuestionParam &&
        response &&
        "clarifyingQuestion" in response &&
        response.clarifyingQuestion &&
        !("derivedSpec" in response)
      ) {
        setClarifyingQuestion(response.clarifyingQuestion);
        setOriginalQuery(trimmedQuery);
        setClarifyingAnswer("");
        return;
      }
      setAwaitingClarification(false);
      setAskQuestion(false);
    } catch {
      setAwaitingClarification(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSubmit(false);
  };

  const handleSearchWithQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    void runSubmit(true);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyingAnswer.trim()) return;
    void runSubmit(false);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={isLoading || awaitingClarification}
        placeholder={String((dict as Record<string, unknown>).search_placeholder ?? "")}
        rows={3}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
      />
      <div className="flex items-center gap-3">
        {/* biome-ignore lint/a11y/useSemanticElements: simple group of buttons */}
        <div
          role="group"
          aria-label={String((dict as Record<string, unknown>).marketplace_label ?? "Marketplace")}
          className="flex items-center gap-2"
        >
          {(["both", "ricardo", "tutti"] as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              disabled={isLoading || awaitingClarification}
              onClick={() => setPlatform(p)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                platform === p
                  ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                  : "bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {String((dict as Record<string, unknown>)[`platform_${p}`] ?? p)}
            </button>
          ))}
        </div>
      </div>
      {awaitingClarification && clarifyingQuestion ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-900/20 dark:border-amber-800 space-y-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {String((dict as Record<string, unknown>).clarification_title ?? "One more question")}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">{clarifyingQuestion}</p>
          <textarea
            value={clarifyingAnswer}
            onChange={(e) => setClarifyingAnswer(e.target.value)}
            rows={2}
            disabled={isLoading}
            placeholder={String(
              (dict as Record<string, unknown>).clarification_answer_placeholder ?? "Your answer",
            )}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
          <button
            type="button"
            disabled={isLoading || !clarifyingAnswer.trim()}
            onClick={handleConfirm}
            className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {isLoading
              ? String(
                  (dict as Record<string, unknown>).asking_clarification ??
                    "Asking a clarifying question…",
                )
              : String((dict as Record<string, unknown>).confirm ?? "Confirm")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading || query.trim().length < 3 || awaitingClarification}
            className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {isLoading
              ? String((dict as Record<string, unknown>).searching_marketplaces ?? "Searching…")
              : String((dict as Record<string, unknown>).search_button ?? "Search")}
          </button>
          <button
            type="button"
            disabled={isLoading || query.trim().length < 3 || awaitingClarification}
            onClick={handleSearchWithQuestion}
            className="rounded-full border border-zinc-300 bg-white px-6 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {String(
              (dict as Record<string, unknown>).search_with_question ?? "Search with question",
            )}
          </button>
          {isLoading && (
            <span className="text-sm text-zinc-500">
              {String(
                (dict as Record<string, unknown>).searching_marketplaces ??
                  "Searching marketplaces…",
              )}
            </span>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
