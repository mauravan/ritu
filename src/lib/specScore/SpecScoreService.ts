import { logger } from "../logger";
import type { DerivedSpec, RawProduct } from "../types";
import { DeterministicSpecScorer } from "./DeterministicSpecScorer";
import { JevSpecScorer } from "./JevSpecScorer";
import type { SpecScoreOutcome, SpecScorer } from "./SpecScorer";

export class SpecScoreService {
  constructor(
    private readonly primary: SpecScorer,
    private readonly fallback: SpecScorer,
  ) {}

  async score(products: RawProduct[], spec: DerivedSpec): Promise<SpecScoreOutcome> {
    if (products.length === 0) return { scores: new Map(), source: "deterministic" };
    try {
      const r = await this.primary.score(products, spec);
      if (r.size === products.length) {
        logger.info(`[RITU][SPEC] Jev scored ${r.size}/${products.length} — using Jev result`);
        return { scores: r, source: "jev" };
      }
      logger.warn(
        `[RITU][SPEC] Jev scored ${r.size}/${products.length} — falling back to deterministic`,
      );
      const fb = await this.fallback.score(products, spec);
      return { scores: fb, source: "deterministic" };
    } catch (e) {
      logger.warn(
        `[RITU][SPEC] Jev spec scoring failed: ${e instanceof Error ? e.message : String(e)} — falling back to deterministic`,
      );
      const fb = await this.fallback.score(products, spec);
      return { scores: fb, source: "deterministic" };
    }
  }
}

export const getSpecScoreService = (): SpecScoreService =>
  new SpecScoreService(new JevSpecScorer(), new DeterministicSpecScorer());
