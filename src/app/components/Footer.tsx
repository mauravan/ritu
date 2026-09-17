"use client";

export default function Footer({
  dict,
  version,
}: {
  dict: { footer_note: string };
  version: string;
}) {
  return (
    <footer className="border-t border-border bg-panel px-3 sm:px-6 py-2.5 flex justify-between items-center text-xs text-text-secondary">
      <div className="flex items-center gap-2 truncate">
        <span className="text-border" aria-hidden="true">
          └─
        </span>
        <span className="truncate">{dict.footer_note}</span>
      </div>
      <span className="shrink-0 font-medium">v{version}</span>
    </footer>
  );
}
