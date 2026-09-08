import type { RawProduct, DerivedSpec, RankedProduct, Tag } from "./types";

const STOPWORDS = new Set(["mit", "für", "und", "the", "for", "with", "a", "an", "und", "der", "die", "das"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function keywordsFromSpec(spec: DerivedSpec): string[] {
  const all = [
    ...spec.requirements.map((r) => r.value),
    ...spec.searchQueries,
    spec.category,
  ].join(" ");
  return tokenize(all);
}

export function rankProducts(products: RawProduct[], spec: DerivedSpec): RankedProduct[] {
  if (products.length === 0) return [];

  // Calculate specScore
  const keywords = keywordsFromSpec(spec);
  const requirementTokens = spec.requirements.map((r) => ({
    tokens: tokenize(r.value),
    importance: r.importance,
    key: r.key,
    value: r.value,
  }));

  const scored = products.map((p) => {
    const titleLower = p.title.toLowerCase();
    const rawText = typeof p.raw === "string" ? p.raw.toLowerCase() : JSON.stringify(p.raw ?? "").toLowerCase();
    let score = 0;
    const matchedRequirements: string[] = [];

    for (const req of requirementTokens) {
      let hit = false;
      for (const tok of req.tokens) {
        if (titleLower.includes(tok)) {
          score += req.importance === "required" ? 20 : 10;
          hit = true;
          break;
        } else if (rawText.includes(tok)) {
          score += req.importance === "required" ? 10 : 5;
          hit = true;
          break;
        }
      }
      if (hit) matchedRequirements.push(`${req.key}: ${req.value}`);
    }

    // keyword hits
    for (const kw of keywords) {
      if (titleLower.includes(kw)) score += 2;
    }

    // category bonus
    if (titleLower.includes(spec.category.toLowerCase())) score += 10;

    // cap 100
    const specScore = Math.min(100, score);

    return { product: p, specScore, matchedRequirements };
  });

  // valueScore
  const prices = scored.map((s) => s.product.priceChf).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const priceRange = maxPrice - minPrice || 1;

  const withValue = scored.map((s) => {
    let valueScore: number;
    if (s.product.priceChf === null) {
      valueScore = s.specScore * 0.6;
    } else {
      const normalizedPrice = (s.product.priceChf - minPrice) / priceRange;
      valueScore = s.specScore * (1 - 0.5 * normalizedPrice);
    }
    return { ...s, valueScore };
  });

  // sort by valueScore desc, then specScore desc
  withValue.sort((a, b) => {
    if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
    return b.specScore - a.specScore;
  });

  // Tagging
  const ranked: RankedProduct[] = withValue.map((s, idx) => ({
    ...s.product,
    specScore: Math.round(s.specScore),
    valueScore: Math.round(s.valueScore),
    matchedRequirements: s.matchedRequirements,
    reasons: [],
    tags: [] as Tag[],
  }));

  if (ranked.length === 0) return ranked;

  // Fill reasons
  for (const r of ranked) {
    if (r.matchedRequirements.length) r.reasons.push(`Matches: ${r.matchedRequirements.join(", ")}`);
    if (r.priceChf !== null) r.reasons.push(`Price CHF ${r.priceChf}`);
    if (r.condition) r.reasons.push(`Condition: ${r.condition}`);
  }

  // Single product gets both best specs + best value
  if (ranked.length === 1) {
    ranked[0]!.tags.push("best specs", "best value");
    // also cheapest if applicable
    if (ranked[0]!.priceChf !== null && ranked[0]!.specScore >= 40) ranked[0]!.tags.push("cheapest");
    return ranked;
  }

  // Determine tags
  let maxSpec = -1;
  let maxSpecIdx = 0;
  let maxValue = -1;
  let maxValueIdx = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i]!.specScore > maxSpec) {
      maxSpec = ranked[i]!.specScore;
      maxSpecIdx = i;
    }
    if (ranked[i]!.valueScore > maxValue) {
      maxValue = ranked[i]!.valueScore;
      maxValueIdx = i;
    }
  }

  ranked[maxSpecIdx]!.tags.push("best specs");

  // best value: different product from best specs when possible, else same if only one max
  if (maxValueIdx !== maxSpecIdx) {
    ranked[maxValueIdx]!.tags.push("best value");
  } else {
    // find second best value
    let secondMax = -1;
    let secondIdx = -1;
    for (let i = 0; i < ranked.length; i++) {
      if (i === maxValueIdx) continue;
      if (ranked[i]!.valueScore > secondMax) {
        secondMax = ranked[i]!.valueScore;
        secondIdx = i;
      }
    }
    if (secondIdx !== -1 && secondMax >= 0) {
      ranked[secondIdx]!.tags.push("best value");
    } else {
      // fallback to same product
      if (!ranked[maxValueIdx]!.tags.includes("best value")) ranked[maxValueIdx]!.tags.push("best value");
    }
  }

  // cheapest: min price where specScore>=40
  let cheapestIdx = -1;
  let cheapestPrice = Infinity;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i]!.specScore >= 40 && ranked[i]!.priceChf !== null && ranked[i]!.priceChf! < cheapestPrice) {
      cheapestPrice = ranked[i]!.priceChf!;
      cheapestIdx = i;
    }
  }
  if (cheapestIdx !== -1) {
    if (!ranked[cheapestIdx]!.tags.includes("cheapest")) ranked[cheapestIdx]!.tags.push("cheapest");
  }

  // best condition: condition new + specScore>=50, max one (highest specScore among those)
  let bestCondIdx = -1;
  let bestCondScore = -1;
  for (let i = 0; i < ranked.length; i++) {
    const c = ranked[i]!.condition?.toLowerCase();
    if ((c === "new" || c === "neu") && ranked[i]!.specScore >= 50 && ranked[i]!.specScore > bestCondScore) {
      bestCondScore = ranked[i]!.specScore;
      bestCondIdx = i;
    }
  }
  if (bestCondIdx !== -1) {
    ranked[bestCondIdx]!.tags.push("best condition");
  }

  // balanced: best harmonic mean, if >=4 products, not already tagged
  if (ranked.length >= 4) {
    let bestH = -1;
    let bestHIdx = -1;
    for (let i = 0; i < ranked.length; i++) {
      if (ranked[i]!.tags.length > 0) continue;
      const s = ranked[i]!.specScore;
      const v = ranked[i]!.valueScore;
      if (s <= 0 || v <= 0) continue;
      const h = 2 / (1 / s + 1 / v);
      if (h > bestH) {
        bestH = h;
        bestHIdx = i;
      }
    }
    if (bestHIdx !== -1) ranked[bestHIdx]!.tags.push("balanced");
  }
  return ranked;
}
