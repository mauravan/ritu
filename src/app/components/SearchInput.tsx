export default function SearchInput({
  query,
  setQuery,
  disabled,
  placeholder,
  label,
}: {
  query: string;
  setQuery: (q: string) => void;
  disabled: boolean;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative flex items-start gap-2 bg-panel p-2.5 border border-border rounded-[2px] focus-within:border-focus">
      <span
        className="text-interface-accent select-none font-bold text-sm leading-6"
        aria-hidden="true"
      >
        &gt;
      </span>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        rows={3}
        className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none resize-none leading-6 disabled:opacity-50"
      />
    </div>
  );
}
