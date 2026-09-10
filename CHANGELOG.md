# Changelog

## 1.0.0 (initial)

- `deriveSpecs`: structured validation (`DerivedSpecSchema`) via `generateObject` (openrouter/gpt-4o-mini default), with `generateText` JSON fallback; throws `ValidationError` / `SpecDerivationError`.
- GPU ranking restoration: `signalRegistry` with `gpu` compare (series/model, ±5); `rankProductsUnified` computes `specScore`, `valueScore`, scaled hybrid; tags (`best specs`, `best value`, `cheapest`, `best condition`, `balanced`, `best overall`).
- Rate limit module (`src/lib/marketplaces/rateLimit.ts`): `p-limit` concurrency, token-bucket throttle, retry with 429/1015 detection and `Retry-After` parsing; env-configurable (`RICARDO_*` / `TUTTI_*` / `RATE_LIMIT_*`).
