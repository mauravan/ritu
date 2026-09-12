"use client";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { useEffect, useState } from "react";
import "./globals.css";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import pkg from "../../package.json";

const dictionaries: Record<string, typeof en> = { en, de };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState("de");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("locale") : null;
    if (stored === "en" || stored === "de") setLocale(stored);
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
