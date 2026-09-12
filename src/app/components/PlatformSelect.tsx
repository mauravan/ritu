import type { Platform } from "@/lib/types";

export default function PlatformSelect({
  platform,
  setPlatform,
  dict,
  disabled,
}: {
  platform: Platform;
  setPlatform: (p: Platform) => void;
  dict: Record<string, unknown>;
  disabled: boolean;
}) {
  return (
    <fieldset
      aria-label={String(dict.marketplace_label ?? "Marketplace")}
      className="flex items-center gap-2"
    >
      {(["both", "ricardo", "tutti"] as Platform[]).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={platform === p}
          disabled={disabled}
          onClick={() => setPlatform(p)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            platform === p
              ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
              : "bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          {String((dict as Record<string, unknown>)[`platform_${p}`] ?? p)}
        </button>
      ))}
    </fieldset>
  );
}
