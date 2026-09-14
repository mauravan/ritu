"use client";

import { Info } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

type Dictionary = typeof en;

function getText(dict: Dictionary, key?: string): string | undefined {
  if (!key) return undefined;
  return (dict as Record<string, unknown>)[key] as string | undefined;
}

interface TooltipProps {
  titleKey?: string;
  textKey?: string;
  content?: React.ReactNode;
  buttonClass?: string;
  panelClass?: string;
}

export default function Tooltip({
  titleKey,
  textKey,
  content,
  buttonClass,
  panelClass,
}: TooltipProps) {
  const [locale] = useLocale();
  const dict = dictionaries[locale] ?? dictionaries.de;
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const titleText = titleKey ? (getText(dict, titleKey) ?? titleKey) : undefined;
  const text = textKey ? (getText(dict, textKey) ?? textKey) : undefined;

  const btnClass = buttonClass
    ? buttonClass
    : "ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] leading-none text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const panelClassName = panelClass
    ? panelClass
    : "absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-72 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3 text-xs text-zinc-800 dark:text-zinc-100";

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={titleText ?? "Info"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={btnClass}
      >
        <Info size={10} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={titleText ?? "Info tooltip"}
          className={panelClassName}
          style={{ top: "100%" }}
        >
          {titleText && <div className="font-semibold mb-1">{titleText}</div>}
          {content ? <div>{content}</div> : <div>{text}</div>}
        </div>
      )}
    </span>
  );
}
