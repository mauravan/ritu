"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  side: "left" | "right";
  label: string;
  expandLabel: string;
  onExpand: () => void;
};

export default function PaneRail({ side, label, expandLabel, onExpand }: Props) {
  const Icon = side === "left" ? ChevronRight : ChevronLeft;
  return (
    <div className="h-full border border-border bg-panel rounded-[2px] overflow-hidden">
      <button
        type="button"
        aria-expanded={false}
        aria-label={expandLabel}
        title={expandLabel}
        onClick={onExpand}
        className="w-full h-full flex flex-col items-center gap-2 py-3 text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="pane-legend block [writing-mode:vertical-rl] text-[10px] font-medium">
          {label}
        </span>
      </button>
    </div>
  );
}
