import type { DerivedSpec, RankedProduct, RawProduct, Tag } from "./types";

const STOPWORDS = new Set([
  "mit",
  "für",
  "und",
  "the",
  "for",
  "with",
  "a",
  "an",
  "und",
  "der",
  "die",
  "das",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function keywordsFromSpec(spec: DerivedSpec): string[] {
  const all = [...spec.requirements.map((r) => r.value), ...spec.searchQueries, spec.category].join(
    " ",
  );
  return tokenize(all);
}

// ---------------------------------------------------------------------------
// GPU ranking algorithm (restored)
// ---------------------------------------------------------------------------
function isGpuRequirement(value: string): boolean {
  return /\b(gtx|rtx)\b/i.test(value) && /\b\d{3,4}\b/.test(value);
}
function extractGpuNumber(text: string): number | null {
  const m = text.match(/\b(gtx|rtx)\s*(\d{3,4})\b/i);
  return m ? parseInt(m[2] as string, 10) : null;
}

// ---------------------------------------------------------------------------
// Extensibility: signal registry (future-proof for comparative ranking)
// ---------------------------------------------------------------------------
/**
 * To add a new signal: implement `RankingSignal`, register with
 * `signalRegistry.set(name, signal)`. Default weight is 0; update weights
 * in `route.ts` or pass `weights` to `rankProductsUnified` to activate.
 */
export interface RankingSignal {
  name: string;
  select(spec: DerivedSpec, product: RawProduct): boolean;
  score(spec: DerivedSpec, product: RawProduct): number;
  compare?(spec: DerivedSpec, products: RawProduct[]): Map<string, number>;
}

export const signalRegistry = new Map<string, RankingSignal>();

// Convert existing rankingAlgorithms entries into signalRegistry for unified pipeline
signalRegistry.set("gpu", {
  name: "gpu",
  select: (spec: DerivedSpec) => spec.requirements.some((r) => isGpuRequirement(r.value)),
  score: (spec: DerivedSpec, product: RawProduct) => {
    const requiredGpu = spec.requirements
      .filter((r) => isGpuRequirement(r.value))
      .map((r) => extractGpuNumber(r.value))
      .filter((n): n is number => n !== null);
    if (requiredGpu.length === 0) return 0;
    const titleGpu = extractGpuNumber(product.title.toLowerCase());
    const rawTextLower =
      typeof product.raw === "string"
        ? product.raw.toLowerCase()
        : JSON.stringify(product.raw ?? "").toLowerCase();
    const rawGpu = extractGpuNumber(rawTextLower);
    const productGpu = titleGpu !== null ? titleGpu : rawGpu !== null ? rawGpu : null;
    if (productGpu === null) return 0;
    const bestRequired = Math.max(...requiredGpu);
    const pSeries = Math.floor(productGpu / 100);
    const pModel = productGpu % 100;
    const rSeries = Math.floor(bestRequired / 100);
    const rModel = bestRequired % 100;
    let comparison: number;
    if (pSeries !== rSeries) comparison = pSeries - rSeries;
    else comparison = pModel - rModel;
    return comparison >= 0 ? 5 : -5;
  },
  compare: (spec: DerivedSpec, products: RawProduct[]): Map<string, number> => {
    const requiredGpu = spec.requirements
      .filter((r) => isGpuRequirement(r.value))
      .map((r) => extractGpuNumber(r.value))
      .filter((n): n is number => n !== null);
    if (requiredGpu.length === 0) return new Map();
    const bestRequired = Math.max(...requiredGpu);
    const result = new Map<string, number>();
    for (const product of products) {
      const titleGpu = extractGpuNumber(product.title.toLowerCase());
      const rawTextLower =
        typeof product.raw === "string"
          ? product.raw.toLowerCase()
          : JSON.stringify(product.raw ?? "").toLowerCase();
      const rawGpu = extractGpuNumber(rawTextLower);
      const productGpu = titleGpu !== null ? titleGpu : rawGpu !== null ? rawGpu : null;
      if (productGpu === null) {
        result.set(product.id, 0);
        continue;
      }
      const pSeries = Math.floor(productGpu / 100);
      const pModel = productGpu % 100;
      const rSeries = Math.floor(bestRequired / 100);
      const rModel = bestRequired % 100;
      let comparison: number;
      if (pSeries !== rSeries) comparison = pSeries - rSeries;
      else comparison = pModel - rModel;
      result.set(product.id, comparison >= 0 ? 5 : -5);
    }
    return result;
  },
});

export function tagExplanation(tag: Tag): string {
  switch (tag) {
    case "best specs":
      return "Highest specScore";
    case "best value":
      return "Best valueScore (spec adjusted for price)";
    case "cheapest":
      return "Lowest price among specScore≥40";
    case "best condition":
      return "Best condition 'new/neu' among specScore≥50";
    case "balanced":
      return "Best harmonic mean of spec & value among untagged";
    case "best overall":
      return "Highest unified hybrid score (LLM + spec + value)";
    default:
      return tag;
  }
}

export function rankProductsUnified(
  products: RawProduct[],
  spec: DerivedSpec,
  llmScores?: Map<string, import("./llm/rerank").RerankResult>,
): RankedProduct[] {
  let weights: Record<string, number> = {};
  try {
    const envWeights = process.env.RANKING_SIGNAL_WEIGHTS;
    if (envWeights) weights = JSON.parse(envWeights) as Record<string, number>;
  } catch {
    weights = {};
  }
  // 2. Compute specScore (same logic as rankProducts)
  const keywords = keywordsFromSpec(spec);
  const requirementTokens = spec.requirements.map((r) => ({
    tokens: tokenize(r.value),
    importance: r.importance,
    key: r.key,
    value: r.value,
  }));

  // Pre-compute compare results for applicable compare signals (once per signal)
  const compareResultsBySignal = new Map<string, Map<string, number>>();
  for (const [, signal] of signalRegistry) {
    if (signal.compare) {
      const applies = products.some((pr) => signal.select(spec, pr));
      if (applies) {
        const res = signal.compare(spec, products);
        compareResultsBySignal.set(signal.name, res);
      }
    }
  }

  const scored = products.map((p) => {
    const titleLower = p.title.toLowerCase();
    const rawText =
      typeof p.raw === "string" ? p.raw.toLowerCase() : JSON.stringify(p.raw ?? "").toLowerCase();
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

    for (const kw of keywords) {
      if (titleLower.includes(kw)) score += 2;
    }
    if (titleLower.includes(spec.category.toLowerCase())) score += 10;

    // Domain algorithm bonuses (rankingAlgorithms integrated via signalRegistry)
    const signalBreakdown: { name: string; score: number }[] = [];
    for (const [, signal] of signalRegistry) {
      if (signal.select(spec, p)) {
        const weight = (weights[signal.name] ?? 1) as number;
        if (signal.compare) {
          const compareRes = compareResultsBySignal.get(signal.name);
          if (compareRes?.has(p.id)) {
            const weight = (weights[signal.name] ?? 1) as number;
            const compareValue = (compareRes.get(p.id) ?? 0) * weight;
            if (compareValue !== 0) {
              score += compareValue;
              signalBreakdown.push({ name: signal.name, score: compareValue });
            }
          }
        } else {
          const bonus = signal.score(spec, p) * weight;
          if (bonus !== 0) {
            score += bonus;
            signalBreakdown.push({ name: signal.name, score: bonus });
          }
        }
      }
    }

    const specScore = Math.min(100, score);
    return { product: p, specScore, matchedRequirements, signalBreakdown };
  });

  // 3. valueScore
  const withValue = scored.map((s) => {
    let valueScore: number;
    if (s.product.priceChf === null) {
      valueScore = 0;
    } else {
      valueScore = s.specScore / (s.product.priceChf || 1);
    }
    return { ...s, valueScore };
  });

  const valueScoresArr = withValue.map((w) => w.valueScore);
  const valueMin = Math.min(...valueScoresArr);
  const valueMax = Math.max(...valueScoresArr);
  const specMin = Math.min(...scored.map((s) => s.specScore));
  const specMax = Math.max(...scored.map((s) => s.specScore));
  const scaledResults = withValue.map((w) => {
    const scaledSpec =
      specMax === specMin
        ? 100
        : Math.round(1 + (99 * (w.specScore - specMin)) / (specMax - specMin));
    const scaledValue =
      valueMax === valueMin
        ? 100
        : Math.round(1 + (99 * (w.valueScore - valueMin)) / (valueMax - valueMin));
    return {
      ...w,
      specScore: Math.max(1, Math.min(100, scaledSpec)),
      valueScore: Math.max(1, Math.min(100, scaledValue)),
    };
  });

  // 4. llmScore
  const hasLLM = llmScores && llmScores.size > 0;
  const llmEntries = hasLLM
    ? scaledResults.map((w) => {
        const s = llmScores?.get(w.product.id);
        if (s && s.relevant !== false && (s.relevance ?? 0) >= 30) {
          return s.relevance;
        }
        return 0;
      })
    : scaledResults.map(() => 0);

  // 5. Weights
  const specW = 0.35;
  const valueW = 0.25;
  let llmW: number;
  let finalSpecW = specW;
  let finalValueW = valueW;

  if (hasLLM) {
    llmW = 1 - specW - valueW >= 0 ? 1 - specW - valueW : 0.4;
  } else {
    // Redistribute when LLM absent
    finalSpecW = 0.6;
    finalValueW = 0.4;
    llmW = 0;
  }

  // Ensure weights sum to 1 (approximate) to keep scale meaningful
  const totalW = finalSpecW + finalValueW + llmW;
  if (totalW > 0 && Math.abs(totalW - 1) > 0.001) {
    finalSpecW = finalSpecW / totalW;
    finalValueW = finalValueW / totalW;
  }

  // 6. Hybrid score and sort
  const enriched = scaledResults.map((w, idx) => {
    const llmScore = llmEntries[idx] as number;
    const specScore = w.specScore;
    const valueScore = w.valueScore;
    const hybridScore = Math.round(
      finalSpecW * specScore + finalValueW * valueScore + llmW * llmScore,
    );
    const relevance = hasLLM ? llmScores?.get(w.product.id)?.relevance : undefined;
    const llmReason = hasLLM ? llmScores?.get(w.product.id)?.reason : undefined;
    const rankingMeta = {
      breakdown: w.matchedRequirements
        .map((r) => r)
        .concat(
          w.signalBreakdown.map((sb) => `${sb.score >= 0 ? "+" : ""}${sb.score} (${sb.name})`),
        ),
      valueDerivedFrom: `comparative; batch_min=${valueMin} batch_max=${valueMax}; score=${Math.round(w.valueScore)}`,
    };
    return {
      ...w.product,
      specScore: Math.round(specScore),
      valueScore: Math.round(valueScore * 100) / 100,
      matchedRequirements: w.matchedRequirements,
      reasons: [] as string[],
      tags: [] as Tag[],
      relevance,
      llmReason,
      hybridScore,
      rankingMeta: { ...rankingMeta, signalBreakdown: w.signalBreakdown },
    };
  });

  // Sort by hybridScore desc, then valueScore desc, then specScore desc
  enriched.sort((a, b) => {
    if (b.hybridScore !== a.hybridScore) return b.hybridScore - a.hybridScore;
    if (b.valueScore !== a.valueScore) return b.valueScore - a.valueScore;
    return b.specScore - a.specScore;
  });

  // 7. Fill reasons
  for (const r of enriched) {
    if (r.matchedRequirements.length)
      r.reasons.push(`Matches: ${r.matchedRequirements.join(", ")}`);
    if (r.priceChf !== null) r.reasons.push(`Price CHF ${r.priceChf}`);
    if (r.condition) r.reasons.push(`Condition: ${r.condition}`);
    // Add LLM reason if present
    if (r.llmReason) r.reasons.push(`LLM: ${r.llmReason}`);
  }

  // 8. Tags
  if (enriched.length === 0) return enriched;

  if (enriched.length === 1) {
    enriched[0]?.tags.push("best specs" as Tag);
    enriched[0]?.tags.push("best value" as Tag);
    if (enriched[0]?.priceChf !== null && enriched[0]?.specScore >= 40)
      enriched[0]?.tags.push("cheapest");
    return enriched;
  }

  // best specs: max specScore
  let maxSpec = -1;
  let maxSpecIdx = 0;
  let maxValueScore = -Infinity;
  let maxValueIdx = 0;
  for (let i = 0; i < enriched.length; i++) {
    if (enriched[i]?.specScore > maxSpec) {
      maxSpec = enriched[i]?.specScore;
      maxSpecIdx = i;
    }
    if (enriched[i]?.valueScore > maxValueScore) {
      maxValueScore = enriched[i]?.valueScore;
      maxValueIdx = i;
    }
  }
  enriched[maxSpecIdx]?.tags.push("best specs");

  // best value: different product when possible
  if (maxValueIdx !== maxSpecIdx) {
    enriched[maxValueIdx]?.tags.push("best value");
  } else {
    let secondMax = -Infinity;
    let secondIdx = -1;
    for (let i = 0; i < enriched.length; i++) {
      if (i === maxValueIdx) continue;
      if (enriched[i]?.valueScore > secondMax) {
        secondMax = enriched[i]?.valueScore;
        secondIdx = i;
      }
    }
    if (secondIdx !== -1 && secondMax >= 0) {
      enriched[secondIdx]?.tags.push("best value");
    } else {
      if (!enriched[maxValueIdx]?.tags.includes("best value"))
        enriched[maxValueIdx]?.tags.push("best value");
    }
  }

  // cheapest
  let cheapestIdx = -1;
  let cheapestPrice = Infinity;
  for (let i = 0; i < enriched.length; i++) {
    const item = enriched[i];
    if (item && item.specScore >= 40 && item.priceChf !== null && item.priceChf < cheapestPrice) {
      cheapestPrice = item.priceChf;
      cheapestIdx = i;
    }
  }
  if (cheapestIdx !== -1) {
    if (!enriched[cheapestIdx]?.tags.includes("cheapest"))
      enriched[cheapestIdx]?.tags.push("cheapest");
  }

  // best condition
  let bestCondIdx = -1;
  let bestCondScore = -1;
  for (let i = 0; i < enriched.length; i++) {
    const c = enriched[i]?.condition?.toLowerCase();
    if (
      (c === "new" || c === "neu") &&
      enriched[i]?.specScore >= 50 &&
      enriched[i]?.specScore > bestCondScore
    ) {
      bestCondScore = enriched[i]?.specScore;
      bestCondIdx = i;
    }
  }
  if (bestCondIdx !== -1) {
    enriched[bestCondIdx]?.tags.push("best condition");
  }

  // balanced: harmonic mean among untagged, only if >=4 products
  if (enriched.length >= 4) {
    let bestH = -1;
    let bestHIdx = -1;
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i]?.tags.length > 0) continue;
      const s = enriched[i]?.specScore;
      const v = enriched[i]?.valueScore;
      if (s <= 0 || v <= 0) continue;
      const h = 2 / (1 / s + 1 / v);
      if (h > bestH) {
        bestH = h;
        bestHIdx = i;
      }
    }
    if (bestHIdx !== -1) enriched[bestHIdx]?.tags.push("balanced");
  }

  // best overall: max hybridScore; only assign if not already tagged
  if (enriched.length > 0) {
    let maxHybrid = -Infinity;
    let maxHybridIdx = 0;
    for (let i = 0; i < enriched.length; i++) {
      const item2 = enriched[i];
      if (item2 && item2.hybridScore !== undefined && item2.hybridScore > maxHybrid) {
        maxHybrid = item2.hybridScore;
        maxHybridIdx = i;
      }
    }
    if (!enriched[maxHybridIdx]?.tags.includes("best overall")) {
      enriched[maxHybridIdx]?.tags.push("best overall");
    }
  }

  return enriched;
}
