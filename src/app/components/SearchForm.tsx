"use client";

import { useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import type { Platform, SearchResult } from "@/lib/types";
import LoadingButton from "./LoadingButton";
import PlatformSelect from "./PlatformSelect";
import SearchInput from "./SearchInput";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

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
  const [locale] = useLocale();

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

  const heroTitle = String(
    (dict as Record<string, unknown>).hero_title ?? "Search Ricardo and Tutti at once.",
  );
  const heroDescription = String(
    (dict as Record<string, unknown>).hero_description ??
      "Describe what you need. RITU compares listings by fit and value.",
  );
  const searchPaneLabel = String((dict as Record<string, unknown>).pane_search ?? "search");
  const filtersPaneLabel = String((dict as Record<string, unknown>).pane_filters ?? "filters");
  const searchInputLabel = String(
    (dict as Record<string, unknown>).search_input_label ?? "What are you looking for?",
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-text-primary flex items-baseline gap-2">
          <span className="text-interface-accent select-none" aria-hidden="true">
            &gt;
          </span>
          <span>{heroTitle}</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary max-w-[68ch]">{heroDescription}</p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="border border-border bg-panel rounded-[2px] p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <span className="pane-legend">{searchPaneLabel}</span>
          </div>

          <SearchInput
            query={query}
            setQuery={setQuery}
            disabled={isLoading || awaitingClarification}
            placeholder={String((dict as Record<string, unknown>).search_placeholder ?? "")}
            label={searchInputLabel}
          />

          <div className="pt-2 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="pane-legend text-xs font-medium text-text-secondary">
                {filtersPaneLabel}
              </span>
              <PlatformSelect
                platform={platform}
                setPlatform={setPlatform}
                dict={dict as Record<string, unknown>}
                disabled={isLoading || awaitingClarification}
              />
            </div>

            {!awaitingClarification && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <LoadingButton
                  type="submit"
                  isLoading={isLoading}
                  disabled={isLoading || query.trim().length < 3 || awaitingClarification}
                  className="bracket-tag px-4 py-1.5 text-xs font-medium rounded-[2px] bg-interface-accent text-on-selection hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer text-center"
                >
                  {String((dict as Record<string, unknown>).search_button ?? "Search")}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  isLoading={isLoading}
                  disabled={isLoading || query.trim().length < 3 || awaitingClarification}
                  onClick={handleSearchWithQuestion}
                  className="bracket-tag px-4 py-1.5 text-xs font-medium rounded-[2px] border border-border bg-panel text-text-primary hover:bg-surface-subtle disabled:opacity-50 transition-colors cursor-pointer text-center"
                >
                  {String(
                    (dict as Record<string, unknown>).search_with_question ??
                      "Search with question",
                  )}
                </LoadingButton>
              </div>
            )}
          </div>
        </div>

        {awaitingClarification && clarifyingQuestion && (
          <div className="rounded-[2px] border border-marketplace-accent bg-notice-surface p-3 sm:p-4 space-y-3">
            <p className="text-xs font-semibold text-notice-text">
              {String((dict as Record<string, unknown>).clarification_title ?? "One more question")}
            </p>
            <p className="text-xs sm:text-sm text-notice-text">{clarifyingQuestion}</p>
            <textarea
              value={clarifyingAnswer}
              onChange={(e) => setClarifyingAnswer(e.target.value)}
              rows={2}
              disabled={isLoading}
              placeholder={String(
                (dict as Record<string, unknown>).clarification_answer_placeholder ?? "Your answer",
              )}
              className="w-full rounded-[2px] border border-border bg-panel px-3 py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-focus"
            />
            <div className="flex justify-end">
              <LoadingButton
                type="button"
                isLoading={isLoading}
                disabled={isLoading || !clarifyingAnswer.trim()}
                onClick={handleConfirm}
                className="bracket-tag px-4 py-1.5 text-xs font-medium rounded-[2px] bg-interface-accent text-on-selection hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {String((dict as Record<string, unknown>).confirm ?? "Confirm")}
              </LoadingButton>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-[2px] border border-error-text bg-error-surface text-error-text text-xs"
          >
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
