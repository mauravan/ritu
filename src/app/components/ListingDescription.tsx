"use client";

import { useState } from "react";
import de from "@/dictionaries/de.json";
import en from "@/dictionaries/en.json";
import useLocale from "./useLocale";

const dictionaries = { de, en } as const;

type Status = "idle" | "loading" | "error" | "done";

export default function ListingDescription({
  marketplace,
  id,
}: {
  marketplace: "ricardo" | "tutti";
  id: string;
}) {
  const [locale] = useLocale();
  const dict = (dictionaries[locale] || dictionaries.de) as typeof en;
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState<string | null>(null);

  const handleToggle = async (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open || status !== "idle") return;
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/listing-description?marketplace=${marketplace}&id=${encodeURIComponent(id)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { description: string | null };
      setText(data.description ?? null);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <details
      className="rounded-[2px] border border-border bg-canvas p-2 group"
      onToggle={handleToggle}
    >
      <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary select-none flex items-center gap-1.5">
        <span className="text-interface-accent transition-transform group-open:rotate-90 select-none inline-block">
          ▶
        </span>
        <span>{dict.original_description}</span>
      </summary>
      {status === "idle" ? null : status === "loading" ? (
        <p className="mt-2 text-xs text-text-secondary">{dict.loading_description}</p>
      ) : status === "error" ? (
        <p className="mt-2 text-xs text-error-text">{dict.could_not_load_description}</p>
      ) : text ? (
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed font-mono text-text-primary bg-panel p-2 rounded-[2px] border border-border">
          {text}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">{dict.no_description_available}</p>
      )}
    </details>
  );
}
