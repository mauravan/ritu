"use client";

import { useState } from "react";

type Props = {
  onSearch: (query: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export default function SearchForm({ onSearch, isLoading, error }: Props) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    void onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. i need a small server for home use to run immich photo service"
        rows={3}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isLoading || query.trim().length < 3}
          className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isLoading ? "Searching…" : "Search"}
        </button>
        {isLoading && <span className="text-sm text-zinc-500">Searching marketplaces…</span>}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
