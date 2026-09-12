"use client";

import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";

const dictionaries: Record<string, typeof en> = { en, de };

type Locale = "de" | "en";

export default function Header({
  locale,
  setLocale,
}: {
  locale: string;
  setLocale: (l: Locale) => void;
}) {
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  return (
    <header className="border-b bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold">{dict.header_title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{dict.language_label}</span>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`px-3 py-1 text-xs rounded border transition-colors ${locale === "en" ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white" : "bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
          aria-label="English"
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("de")}
          className={`px-3 py-1 text-xs rounded border transition-colors ${locale === "de" ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white" : "bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
          aria-label="German"
        >
          DE
        </button>
      </div>
    </header>
  );
}
