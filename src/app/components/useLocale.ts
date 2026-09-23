"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "de";
  const stored = localStorage.getItem("locale");
  return stored === "en" || stored === "de" ? stored : "de";
}

function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "en" || detail === "de") setLocale(detail);
    };
    window.addEventListener("locale-change", handleChange);
    return () => window.removeEventListener("locale-change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", locale);
      window.dispatchEvent(new CustomEvent("locale-change", { detail: locale }));
    }
  }, [locale]);

  return [locale, setLocale] as [Locale, (l: Locale) => void];
}

export default useLocale;
