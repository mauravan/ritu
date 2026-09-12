"use client";

import { useEffect, useState } from "react";
import Footer from "./components/Footer";
import Header from "./components/Header";
import "./globals.css";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import pkg from "../../package.json";

const dictionaries: Record<string, typeof en> = { en, de };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(() => {
    if (typeof window === "undefined") return "de";
    const stored = localStorage.getItem("locale");
    return stored === "en" || stored === "de" ? stored : "de";
  });

  useEffect(() => {
    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
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

  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;

  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
        <Header locale={locale} setLocale={setLocale} />
        <main className="flex-1">{children}</main>
        <Footer dict={{ footer_note: dict.footer_note }} version={pkg.version} />
      </body>
    </html>
  );
}
