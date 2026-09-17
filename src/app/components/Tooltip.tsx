"use client";

import { Info } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

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

  const titleText = titleKey
    ? (((dict as Record<string, unknown>)[titleKey] as string | undefined) ?? titleKey)
    : undefined;
  const text = textKey
    ? (((dict as Record<string, unknown>)[textKey] as string | undefined) ?? textKey)
    : undefined;

  const btnClass = buttonClass
    ? buttonClass
    : "ml-1 inline-flex items-center justify-center text-[10px] text-text-secondary hover:text-text-primary focus:outline-none";

  const panelClassName = panelClass
    ? panelClass
    : "absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-72 rounded-[2px] border border-border bg-panel p-3 text-xs text-text-primary shadow-lg";

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
        <Info size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={titleText ?? "Info tooltip"}
          className={panelClassName}
          style={{ top: "100%" }}
        >
          {titleText && (
            <div className="font-semibold text-text-primary mb-1">&gt; {titleText}</div>
          )}
          <div className="text-text-secondary leading-relaxed">{content ? content : text}</div>
        </div>
      )}
    </span>
  );
}
