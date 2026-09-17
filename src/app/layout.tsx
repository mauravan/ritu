"use client";

import { Martian_Mono } from "next/font/google";
import { useEffect, useState } from "react";
import Footer from "./components/Footer";
import Header from "./components/Header";
import "./globals.css";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import pkg from "../../package.json";

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-martian-mono",
  display: "swap",
});

const themeScript = `(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
      return;
    }
  } catch (e) {}
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
      return;
    }
  } catch (e) {}
  document.documentElement.dataset.theme = 'light';
})();`;

const dictionaries: Record<string, typeof en> = { en, de };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState("de");
  useEffect(() => {
    const stored = localStorage.getItem("locale");
    if (stored === "en" || stored === "de") setLocale(stored);
  }, []);

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
    <html
      lang={locale}
      data-theme="light"
      suppressHydrationWarning
      className={martianMono.variable}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: critical inline script for pre-paint theme resolution without flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas text-text-primary font-mono">
        <Header locale={locale} setLocale={setLocale} />
        <main className="flex-1">{children}</main>
        <Footer dict={{ footer_note: dict.footer_note }} version={pkg.version} />
      </body>
    </html>
  );
}
