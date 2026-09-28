import type { RerankResult } from "./llm/rerank";
import type { SpecScoreResult } from "./specScore/SpecScorer";
import type { RankedProduct, RawProduct, Tag } from "./types";

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
  specScores: Map<string, SpecScoreResult>,
  rerankScores?: Map<string, RerankResult>,
): RankedProduct[] {
  const withValue = products.map((p) => {
    const sr = specScores.get(p.id);
    const specScore = sr?.specScore ?? 50;
    const matchedRequirements = sr?.matchedRequirements ?? [];
    const reasons = [...(sr?.reasons ?? [])];
    const valueScore = p.priceChf === null ? 0 : specScore / (p.priceChf || 1);
    return { product: p, specScore, matchedRequirements, reasons, valueScore };
  });

  const valueScoresArr = withValue.map((w) => w.valueScore);
  const valueMin = Math.min(...valueScoresArr);
  const valueMax = Math.max(...valueScoresArr);
  const scaledResults = withValue.map((w) => {
    const scaledValue =
      valueMax === valueMin
        ? 100
        : Math.round(1 + (99 * (w.valueScore - valueMin)) / (valueMax - valueMin));
    return {
      ...w,
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
      reasons: w.reasons,
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
