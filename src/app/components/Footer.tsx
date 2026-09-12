"use client";

export default function Footer({
  dict,
  version,
}: {
  dict: { footer_note: string };
  version: string;
}) {
  return (
    <footer className="border-t bg-white dark:bg-zinc-900 px-6 py-3 flex justify-between items-center text-sm text-zinc-500">
      <span>{dict.footer_note}</span>
      <span>v{version}</span>
    </footer>
  );
}
