import type { SortBy, SortDir } from "@/lib/types";

const FIELDS: SortBy[] = ["spec", "value", "ai", "hybrid", "price", "near"];

function fieldLabel(
  field: SortBy,
  dict: Record<string, unknown>,
): string {
  switch (field) {
    case "spec":
      return String(dict.spec_label ?? "Spec");
    case "value":
      return String(dict.value_label ?? "Value");
    case "ai":
      return String(dict.sort_ai ?? "ai");
    case "hybrid":
      return String(dict.hybrid_label ?? "Hybrid");
    case "price":
      return String(dict.sort_price ?? "price");
    case "near":
      return String(dict.sort_near ?? "near");
  }
}

export default function SortSelect({
  by,
  dir,
  onChange,
  zipSet,
  dict,
  disabled,
}: {
  by: SortBy;
  dir: SortDir;
  onChange: (by: SortBy, dir: SortDir) => void;
  zipSet: boolean;
  dict: Record<string, unknown>;
  disabled: boolean;
}) {
  const label = String(dict.sort_label ?? "sort:");
  const dirWord = String(
    dir === "desc" ? (dict.sort_desc ?? "descending") : (dict.sort_asc ?? "ascending"),
  );
  const ariaTemplate = String(dict.sort_aria ?? "Sort by {label}, {direction}");

  return (
    <fieldset
      aria-label={label}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-xs text-text-secondary select-none">{label}</span>
      {FIELDS.map((field) => {
        const isSelected = by === field;
        const text = fieldLabel(field, dict);
        const isNear = field === "near";
        const isDisabled = disabled || (isNear && !zipSet);
        const arrow = isSelected ? (dir === "desc" ? " ↓" : " ↑") : "";
        return (
          <button
            key={field}
            type="button"
            aria-pressed={isSelected}
            aria-label={ariaTemplate
              .replace("{label}", text)
              .replace("{direction}", dirWord)}
            disabled={isDisabled}
            onClick={() =>
              onChange(field, isSelected ? (dir === "desc" ? "asc" : "desc") : dir)
            }
            className={`bracket-tag px-2 py-1 text-xs rounded-[2px] border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? "bg-selection text-on-selection border-selection font-medium"
                : "bg-panel text-text-secondary border-border hover:bg-surface-subtle hover:text-text-primary"
            }`}
          >
            {text}
            {arrow}
          </button>
        );
      })}
    </fieldset>
  );
}
