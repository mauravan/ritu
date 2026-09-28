# Changelog

## 1.0.0 (initial)

- `deriveSpecs`: structured validation (`DerivedSpecSchema`) via `generateObject` (openrouter/gpt-4o-mini default), with `generateText` JSON fallback; throws `ValidationError` / `SpecDerivationError`.
- GPU ranking restoration: `signalRegistry` with `gpu` compare (series/model, ±5); `rankProductsUnified` computes `specScore`, `valueScore`, scaled hybrid; tags (`best specs`, `best value`, `cheapest`, `best condition`, `balanced`, `best overall`).

## Unreleased

- Spec scoring via Jev (`src/lib/specScore/`): `JevSpecScorer` (primary, `typesafe/jev-1.13` Decisions `fulfills` noul → `specScore`) with `DeterministicSpecScorer` fallback behind `SpecScoreService` (`getSpecScoreService`); `rankProductsUnified(products, specScores, rerankScores?)` is now pure ranking (no spec computation, no `SignalRegistry`); route scores spec + rerank in parallel.
