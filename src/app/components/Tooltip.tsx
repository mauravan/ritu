"use client";

import { Info } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type PanelPos = {
  top: number;
  left: number;
  above: boolean;
};

const PANEL_HALF = 144;
const VIEWPORT_MARGIN = 8;
const GAP = 8;

function measure(btn: HTMLButtonElement | null): PanelPos | null {
  if (!btn || typeof window === "undefined") return null;
  const rect = btn.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const center = rect.left + rect.width / 2;
  const left = Math.min(
    Math.max(center, PANEL_HALF + VIEWPORT_MARGIN),
    Math.max(window.innerWidth - PANEL_HALF - VIEWPORT_MARGIN, PANEL_HALF + VIEWPORT_MARGIN),
  );
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < 220 && rect.top > spaceBelow;
  return {
    top: above ? Math.max(rect.top - GAP, VIEWPORT_MARGIN) : rect.bottom + GAP,
    left,
    above,
  };
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
  const [pos, setPos] = useState<PanelPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Measure after the button has rendered so the panel anchors next to it.
  // (Measuring in the click handler races skipped rendering from
  // `content-visibility: auto` on listing cards and lands elsewhere.)
  useLayoutEffect(() => {
    if (!open) return;
    setPos(measure(btnRef.current));
  }, [open]);

  // Keep the panel glued to the button on scroll/resize while open.
  useEffect(() => {
    if (!open) return;
    const onReposition = () => setPos(measure(btnRef.current));
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const titleText = titleKey
    ? (((dict as Record<string, unknown>)[titleKey] as string | undefined) ?? titleKey)
    : undefined;
  const text = textKey
    ? (((dict as Record<string, unknown>)[textKey] as string | undefined) ?? textKey)
    : undefined;

  const btnClass = buttonClass
    ? buttonClass
    : "ml-1 inline-flex items-center justify-center text-[10px] text-text-secondary hover:text-text-primary focus:outline-none";

  // Portaled to document.body: escapes the listing card's
  // `content-visibility: auto` containment so `position: fixed` is relative
  // to the viewport (correct anchor) and `z-[100]` stacks above listings.
  const panelClassName = panelClass
    ? panelClass
    : "fixed z-[100] w-72 max-w-[calc(100vw-2rem)] rounded-[2px] border border-border bg-panel p-3 text-xs text-text-primary shadow-lg";

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={titleText ?? "Info"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={btnClass}
      >
        <Info size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={titleText ?? "Info tooltip"}
            className={panelClassName}
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
          >
            {titleText && (
              <div className="font-semibold text-text-primary mb-1">&gt; {titleText}</div>
            )}
            <div className="text-text-secondary leading-relaxed">{content ? content : text}</div>
          </div>,
          document.body,
        )}
    </span>
  );
}
