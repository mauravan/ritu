import { logger } from "../logger";
import type { DerivedSpec, RawProduct } from "../types";
import { DeterministicSpecScorer } from "./DeterministicSpecScorer";
import { JevSpecScorer } from "./JevSpecScorer";
import type { SpecScoreResult, SpecScorer } from "./SpecScorer";

export class SpecScoreService implements SpecScorer {
  constructor(
    private readonly primary: SpecScorer,
    private readonly fallback: SpecScorer,
  ) {}

  async score(products: RawProduct[], spec: DerivedSpec): Promise<Map<string, SpecScoreResult>> {
    if (products.length === 0) return new Map();
    try {
      const r = await this.primary.score(products, spec);
      if (r.size === products.length) return r;
      logger.warn(`[RITU][SPEC] Jev scored ${r.size}/${products.length} — falling back to deterministic`);
      return this.fallback.score(products, spec);
    } catch (e) {
      logger.warn(
        `[RITU][SPEC] Jev spec scoring failed: ${e instanceof Error ? e.message : String(e)} — falling back to deterministic`,
      );
      return this.fallback.score(products, spec);
    }
  }
}

export const getSpecScoreService = (): SpecScorer =>
  new SpecScoreService(new JevSpecScorer(), new DeterministicSpecScorer());
