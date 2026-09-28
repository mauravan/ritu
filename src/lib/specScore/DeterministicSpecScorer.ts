import { applyNumericFilter } from "../numericFilter";
import type { DerivedSpec, RawProduct } from "../types";
import type { SpecScoreResult, SpecScorer } from "./SpecScorer";

const STOPWORDS: Record<string, true> = {
  mit: true,
  für: true,
  und: true,
  the: true,
  for: true,
  with: true,
  a: true,
  an: true,
  der: true,
  die: true,
  das: true,
};

const EXCLUDED_TERM_PENALTY = -25;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOPWORDS[t]);
}

function keywordsFromSpec(spec: DerivedSpec): string[] {
  const all = [...spec.requirements.map((r) => r.value), ...spec.searchQueries, spec.category].join(
    " ",
  );
  return tokenize(all);
}

function isGpuRequirement(value: string): boolean {
  return /\b(gtx|rtx)\b/i.test(value) && /\b\d{3,4}\b/.test(value);
}

function extractGpuNumber(text: string): number | null {
  const m = text.match(/\b(gtx|rtx)\s*(\d{3,4})\b/i);
  return m ? parseInt(m[2] as string, 10) : null;
}

function excludedTermPenalties(products: RawProduct[], spec: DerivedSpec): Map<string, string> {
  const matches = new Map<string, string>();
  const terms = (spec.excludedTerms ?? [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);
  if (terms.length === 0) return matches;
  for (const p of products) {
    const title = p.title.toLowerCase();
    const hit = terms.find((t) => title.includes(t));
    if (hit) matches.set(p.id, hit);
  }
  return matches;
}

export class DeterministicSpecScorer implements SpecScorer {
  async score(products: RawProduct[], spec: DerivedSpec): Promise<Map<string, SpecScoreResult>> {
    const result = new Map<string, SpecScoreResult>();
    if (products.length === 0) return result;

    let weights: Record<string, number> = {};
    try {
      const envWeights = process.env.RANKING_SIGNAL_WEIGHTS;
      if (envWeights) weights = JSON.parse(envWeights) as Record<string, number>;
    } catch {
      weights = {};
    }

    const { penalties: numericPenalties, penaltyFields } = applyNumericFilter(products, spec);
    const excludedPenalties = excludedTermPenalties(products, spec);
    const keywords = keywordsFromSpec(spec);
    const requirementTokens = spec.requirements.map((r) => ({
      tokens: tokenize(r.value),
      importance: r.importance,
      key: r.key,
      value: r.value,
    }));
    const gpuCompare = this.gpuCompare(spec, products, weights.gpu ?? 1);

    const rawScores: { id: string; raw: number; matchedRequirements: string[] }[] = products.map(
      (p) => {
        const titleLower = p.title.toLowerCase();
        const rawText =
          typeof p.raw === "string"
            ? p.raw.toLowerCase()
            : JSON.stringify(p.raw ?? "").toLowerCase();
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

        const gpuValue = gpuCompare.get(p.id) ?? 0;
        if (gpuValue !== 0) score += gpuValue;

        const penalty =
          (numericPenalties.get(p.id) ?? 0) +
          (excludedPenalties.has(p.id) ? EXCLUDED_TERM_PENALTY : 0);
        if (penalty !== 0) score += penalty;

        return {
          id: p.id,
          raw: Math.min(100, Math.max(1, score)),
          matchedRequirements,
        };
      },
    );

    const raws = rawScores.map((s) => s.raw);
    const specMin = Math.min(...raws);
    const specMax = Math.max(...raws);

    for (const s of rawScores) {
      const scaled =
        specMax === specMin ? 100 : Math.round(1 + (99 * (s.raw - specMin)) / (specMax - specMin));
      const specScore = Math.max(1, Math.min(100, scaled));
      const reasons: string[] = [];
      if (s.matchedRequirements.length > 0)
        reasons.push(`Matches: ${s.matchedRequirements.join(", ")}`);
      const exclTerm = excludedPenalties.get(s.id);
      if (exclTerm) reasons.push(`Penalty: excluded term "${exclTerm}"`);
      const numericFields = penaltyFields.get(s.id);
      if (numericFields?.length)
        reasons.push(`Penalty: numeric mismatch (${numericFields.join(", ")})`);
      result.set(s.id, { specScore, matchedRequirements: s.matchedRequirements, reasons });
    }
    return result;
  }

  private gpuCompare(
    spec: DerivedSpec,
    products: RawProduct[],
    weight: number,
  ): Map<string, number> {
    const result = new Map<string, number>();
    if (!spec.requirements.some((r) => isGpuRequirement(r.value))) return result;
    const requiredGpu = spec.requirements
      .filter((r) => isGpuRequirement(r.value))
      .map((r) => extractGpuNumber(r.value))
      .filter((n): n is number => n !== null);
    const bestRequired = Math.max(...requiredGpu);
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
      result.set(product.id, (comparison >= 0 ? 5 : -5) * weight);
    }
    return result;
  }
}
