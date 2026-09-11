export function extractListingDescription(
  detail: unknown,
  marketplace: "ricardo" | "tutti",
): string | null {
  if (typeof detail !== "object" || detail === null) return null;
  const key = marketplace === "ricardo" ? "description" : "body";
  const value = (detail as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function formatListingDescription(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
      const map: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      return map[e.toLowerCase()] ?? m;
    })
    .replace(/&#(\d+);/g, (m, n) => {
      const cp = Number(n);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
