import { applyNumericFilter } from "./numericFilter";
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
/** Singleton — ensures single signal registry instance across ranking modules. */
export class SignalRegistry {
  private static instance: SignalRegistry;
  private registry: Map<string, RankingSignal>;

  private constructor() {
    this.registry = new Map<string, RankingSignal>();
  }

  public static getInstance(): SignalRegistry {
    if (!SignalRegistry.instance) {
      SignalRegistry.instance = new SignalRegistry();
    }
    return SignalRegistry.instance;
  }

  register(name: string, signal: RankingSignal): void {
    this.registry.set(name, signal);
  }

  set(name: string, signal: RankingSignal): void {
    this.registry.set(name, signal);
  }

  [Symbol.iterator](): IterableIterator<[string, RankingSignal]> {
    return this.registry.entries();
  }
}

export const signalRegistry = SignalRegistry.getInstance();
signalRegistry.set("gpu", {
  name: "gpu",
  select: (spec: DerivedSpec) => spec.requirements.some((r) => isGpuRequirement(r.value)),
  compare: (spec: DerivedSpec, products: RawProduct[]): Map<string, number> => {
    const requiredGpu = spec.requirements
      .filter((r) => isGpuRequirement(r.value))
      .map((r) => extractGpuNumber(r.value))
      .filter((n): n is number => n !== null);
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
      return "Highest unified hybrid score (AI + spec + value)";
    default:
      return tag;
  }
}

export function rankProductsUnified(
  products: RawProduct[],
  spec: DerivedSpec,
  rerankScores?: Map<string, import("./llm/rerank").RerankResult>,
): RankedProduct[] {
  let weights: Record<string, number> = {};
  try {
    const envWeights = process.env.RANKING_SIGNAL_WEIGHTS;
    if (envWeights) weights = JSON.parse(envWeights) as Record<string, number>;
  } catch {
    weights = {};
  }
  const candidates = products;
  // Display-all mode: numeric mismatches only penalize scores; nothing is excluded.
  const numericPenalties = applyNumericFilter(candidates, spec).penalties;
  const filteredCandidates = candidates;
  // 2. Compute specScore (same logic as rankProducts)
  const keywords = keywordsFromSpec(spec);
  const requirementTokens = spec.requirements.map((r) => ({
    tokens: tokenize(r.value),
    importance: r.importance,
    key: r.key,
    value: r.value,
  }));
  const compareResultsBySignal = new Map<string, Map<string, number>>();
  for (const [, signal] of signalRegistry) {
    const applies = filteredCandidates.some((pr) => signal.select(spec, pr));
    if (applies) {
      const res = signal.compare(spec, filteredCandidates);
      compareResultsBySignal.set(signal.name, res);
    }
  }
  const scored = filteredCandidates.map((p) => {
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
    for (const [, signal] of signalRegistry) {
      if (signal.select(spec, p)) {
        const weight = (weights[signal.name] ?? 1) as number;
        const compareRes = compareResultsBySignal.get(signal.name);
        if (compareRes?.has(p.id)) {
          const compareValue = (compareRes.get(p.id) ?? 0) * weight;
          if (compareValue !== 0) {
            score += compareValue;
          }
        }
      }
    }
    const penalty = numericPenalties.get(p.id) ?? 0;
    if (penalty !== 0) score += penalty;

    const specScore = Math.min(100, Math.max(1, score));
    return { product: p, specScore, matchedRequirements };
  });
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

  // 4. rerank score
  const hasRerank = rerankScores && rerankScores.size > 0;
  const rerankEntries = hasRerank
    ? scaledResults.map((w) => rerankScores?.get(w.product.id)?.relevance ?? 0)
    : scaledResults.map(() => 0);

  // 5. Weights
  const specW = 0.35;
  const valueW = 0.25;
  let rerankW: number;
  let finalSpecW = specW;
  let finalValueW = valueW;

  if (hasRerank) {
    rerankW = 1 - specW - valueW;
  } else {
    // Redistribute when rerank absent
    finalSpecW = 0.6;
    finalValueW = 0.4;
    rerankW = 0;
  }

  // 6. Hybrid score and sort
  const enriched = scaledResults.map((w, idx) => {
    const rerankScore = rerankEntries[idx] as number;
    const specScore = w.specScore;
    const valueScore = w.valueScore;
    const hybridScore = Math.round(
      finalSpecW * specScore + finalValueW * valueScore + rerankW * rerankScore,
    );
    const relevance = hasRerank ? rerankScores?.get(w.product.id)?.relevance : undefined;
    return {
      ...w.product,
      specScore: Math.round(specScore),
      valueScore: Math.round(valueScore * 100) / 100,
      matchedRequirements: w.matchedRequirements,
      reasons: [] as string[],
      tags: [] as Tag[],
      relevance,
      hybridScore,
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
    let secondIdx = 0;
    for (let i = 0; i < enriched.length; i++) {
      if (i === maxValueIdx) continue;
      if ((enriched[i]?.valueScore ?? -Infinity) > secondMax) {
        secondMax = enriched[i]?.valueScore ?? -Infinity;
        secondIdx = i;
      }
    }
    enriched[secondIdx]?.tags.push("best value");
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
      const s = enriched[i]?.specScore ?? 1;
      const v = enriched[i]?.valueScore ?? 1;
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

// Test exports
export { extractGpuNumber, isGpuRequirement, keywordsFromSpec, tokenize };
