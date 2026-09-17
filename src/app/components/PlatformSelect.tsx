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
  const sourceLabel = String(dict.source_label ?? dict.marketplace_label ?? "source");

  return (
    <fieldset
      aria-label={String(dict.marketplace_label ?? "Marketplace")}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-xs text-text-secondary select-none">{sourceLabel}:</span>
      {(["both", "ricardo", "tutti"] as Platform[]).map((p) => {
        const isSelected = platform === p;
        const text = String((dict as Record<string, unknown>)[`platform_${p}`] ?? p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => setPlatform(p)}
            className={`bracket-tag px-2 py-1 text-xs rounded-[2px] border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? "bg-selection text-on-selection border-selection font-medium"
                : "bg-panel text-text-secondary border-border hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {text}
          </button>
        );
      })}
    </fieldset>
  );
}
