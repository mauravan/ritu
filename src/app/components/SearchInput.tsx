export default function SearchInput({
  query,
  setQuery,
  disabled,
  placeholder,
}: {
  query: string;
  setQuery: (q: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <textarea
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={3}
      className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
    />
  );
}
