import type { RankedProduct, SortBy, SortDir } from "./types";

function numericField(p: RankedProduct, by: SortBy): number | null | undefined {
  switch (by) {
    case "spec":
      return p.specScore;
    case "value":
      return p.valueScore;
    case "ai":
      return p.relevance;
    case "hybrid":
      return p.hybridScore;
    case "price":
      return p.priceChf;
  }
}

function tiebreak(a: RankedProduct, b: RankedProduct): number {
  const ka = `${a.marketplace}:${a.id}`;
  const kb = `${b.marketplace}:${b.id}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export function sortProducts(products: RankedProduct[], by: SortBy, dir: SortDir): RankedProduct[] {
  const out = [...products];
  const flip = dir === "desc" ? -1 : 1;

  out.sort((a, b) => {
    const va = numericField(a, by);
    const vb = numericField(b, by);
    const aMissing = va === null || va === undefined;
    const bMissing = vb === null || vb === undefined;
    if (aMissing && bMissing) return tiebreak(a, b);
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (va !== vb) return ((va as number) < (vb as number) ? -1 : 1) * flip;
    return tiebreak(a, b);
  });
  return out;
}
