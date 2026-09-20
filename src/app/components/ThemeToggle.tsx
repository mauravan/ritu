"use client";

import { useEffect } from "react";

export default function ThemeToggle({ label }: { label: string }) {
  useEffect(() => {
    let hasStored = false;
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") {
        hasStored = true;
      }
    } catch {}

    if (hasStored) {
      return;
    }

    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      let isOverridden = false;
      try {
        const currentStored = localStorage.getItem("theme");
        if (currentStored === "light" || currentStored === "dark") {
          isOverridden = true;
        }
      } catch {}

      if (!isOverridden) {
        document.documentElement.dataset.theme = e.matches ? "dark" : "light";
      }
    };

    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, []);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-[2px] border border-border bg-panel text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer text-base leading-none"
    >
      <span className="theme-glyph-light select-none text-sm font-semibold" aria-hidden="true">
        ☾
      </span>
      <span className="theme-glyph-dark select-none text-xl font-semibold" aria-hidden="true">
        ☼
      </span>
    </button>
  );
}
