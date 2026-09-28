import type { DerivedSpec, RawProduct } from "../types";

export interface SpecScoreResult {
  specScore: number; // final 0-100, no further batch scaling
  matchedRequirements: string[]; // e.g. "ram: 16gb"
  reasons: string[]; // match/penalty reasons (no condition line)
}

export interface SpecScorer {
  score(products: RawProduct[], spec: DerivedSpec): Promise<Map<string, SpecScoreResult>>;
}
