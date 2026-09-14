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
    <details className="rounded bg-zinc-100 dark:bg-zinc-800 p-2" onToggle={handleToggle}>
      <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">
        {dict.original_description}
      </summary>
      {status === "idle" ? null : status === "loading" ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{dict.loading_description}</p>
      ) : status === "error" ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {dict.could_not_load_description}
        </p>
      ) : text ? (
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed font-mono text-zinc-600 dark:text-zinc-400">
          {text}
        </pre>
      ) : (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {dict.no_description_available}
        </p>
      )}
    </details>
  );
}
