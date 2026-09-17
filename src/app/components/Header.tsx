"use client";

import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import ThemeToggle from "./ThemeToggle";

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
    <header className="border-b border-border bg-panel px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-text-primary tracking-tight">
        <span className="text-interface-accent" aria-hidden="true">
          ┌─
        </span>
        <span className="font-semibold">ritu://market-scan</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        <ThemeToggle label={dict.theme_toggle_label} />
        <div className="inline-flex items-center border border-border rounded-[2px] p-0.5 bg-canvas">
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={`px-2 py-1 rounded-[2px] transition-colors cursor-pointer ${
              locale === "en"
                ? "bg-selection text-on-selection font-medium"
                : "text-text-secondary hover:text-text-primary"
            }`}
            aria-label="English"
          >
            EN
          </button>
          <span className="text-border" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            onClick={() => setLocale("de")}
            className={`px-2 py-1 rounded-[2px] transition-colors cursor-pointer ${
              locale === "de"
                ? "bg-selection text-on-selection font-medium"
                : "text-text-secondary hover:text-text-primary"
            }`}
            aria-label="German"
          >
            DE
          </button>
        </div>
      </div>
    </header>
  );
}
