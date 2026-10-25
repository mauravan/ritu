# Architecture

## Pipeline (`POST /api/search`)

Browser → `src/app/api/search/route.ts`

1. Parse `SearchRequestSchema` (query 3–500 chars, platform `both`/`ricardo`/`tutti`, locale, optional zip/radius).
2. Derive specs: `deriveSpecs` (`src/lib/llm/deriveSpecs.ts`) — structured `generateObject` against `DerivedSpecSchema`, fallback to `generateText` + manual JSON parse. Throws `ValidationError` (bad input <3 chars) or `SpecDerivationError`.
3. Accessory guard: sanitize `searchQueries` dropping terms matching accessory set (`hülle`, `huelle`, `tasche`, `sleeve`, `cover`, `case`, `halterung`, `schutz`, `folie`, `ständer`, `staender`) unless category is accessory-related; restore original if all dropped, else fall back to `[spec.category]`.
4. Fan-out queries: the raw user query (trimmed) is always prepended to `searchQueries` if absent, then `searchQueries.flatMap` → `MarketplaceQuery[]` (`ricardo` and/or `tutti`) with `buildRicardoUrl` / `buildTuttiUrl`.
5. Parallel fetch: `Promise.allSettled` for `searchRicardo` / `searchTutti` (20 limit each). Rejected excluded; fulfilled aggregated.
6. Aggregate: `aggregate` (`src/lib/aggregate.ts`) — dedup by `normalizeTitle(title)|priceChf` (keep cheapest), then by `marketplace:id`.
7. LLM rerank (optional): `rerankWithLLM` (`src/lib/llm/rerank.ts`) — `generateObject` with `RerankSchema`, capped at `LLM_RERANK_MAX_BATCH` (default 40), timeout 15000ms; returns `Map<id, RerankResult>`. Empty or error falls back to deterministic ranking.
8. Spec score: `getSpecScoreService()` (`src/lib/specScore/SpecScoreService.ts`) — primary `JevSpecScorer` asks `typesafe/jev-1.13` via the OpenRouter Decisions API (one `fulfills` noul question per listing, `specScore = clamp(round(noul * 100), 1, 100)`); on missing `LLM_API_KEY`, any Jev error, or partial results it falls back to `DeterministicSpecScorer` (token/keyword match + GPU compare ±5 + numeric/excluded-term penalties, batch-scaled 1–100). Env: `LLM_API_KEY`, `JEV_MODEL`, `JEV_SPEC_CONCURRENCY` (default 4), `JEV_SPEC_TIMEOUT_MS` (default 15000), `RANKING_SIGNAL_WEIGHTS` (gpu weight, deterministic path only).
9. Rank: `rankProductsUnified` (`src/lib/ranking.ts`) — pure ranking over the precomputed spec-score map (`specScore` used as-is, never re-scaled); `valueScore` (spec / price), scaled 1–100; hybrid `0.35 spec + 0.25 value + LLM weight` (LLM present: weight = `1 - 0.35 - 0.25`; else weights redistribute to 0.6/0.4). Sort by hybrid → value → spec.
10. Tags (`Tag`): `best specs` (max spec), `best value` (max value, different index preferred), `cheapest` (price < others with spec ≥40), `best condition` (`new`/`neu` with spec ≥50), `balanced` (harmonic mean among untagged, ≥4 products), `best overall` (max hybrid, untagged preferred).

## LLM modules (`src/lib/llm/`)

- `deriveSpecs`: structured validation (`DerivedSpecSchema`). Env: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
- `rerank`: relevance scoring (`RerankSchema`), strict accessory exclusion. Env: `LLM_API_KEY`, `LLM_RERANK_BASE_URL`, `LLM_RERANK_MODEL`, `LLM_RERANK_TIMEOUT_MS`, `LLM_RERANK_MAX_BATCH`, `LLM_RERANK_TIMEOUT`.
- `prompt.ts`: `SYSTEM_PROMPT` for deriveSpecs.

## Marketplace adapters (`src/lib/marketplaces/`)

- `ricardo`: `RicardoClient` (`ricardo-api` library) mobile endpoint `/m/search` with AWS SigV4 (`x-authorization`). No web cookies (cause 403 WAF). Price parsed from `buyNowPrice`/`bidPrice` (divided by 100), image from `images[0].rendition.src` (replaces `t_265x200` with `t_800x600`). URL built from slugified title + id.
- `tutti`: `tutti-api` (`TuttiClient`) GraphQL only (no Playwright fallback). `searchTuttiViaApi` with 8000ms race timeout; parses `formattedPrice` (CHF-prefixed or `650.-` form) via regex. Normalizes image URL (`//` → `https:`, `/` → `https://www.tutti.ch`). Throws on 429/1015 for retry. Env rate limits apply.
- `index.ts`: `MarketplaceAdapter` interface (`search`, `buildUrl`).

## Spec scoring (`src/lib/specScore/`)

 - `SpecScorer` interface (`SpecScorer.ts`): `score(products, spec)` → `Map<productId, SpecScoreResult>` (`specScore` final 0–100, `matchedRequirements`, `reasons`).
 - `JevSpecScorer`: primary; one Decisions `fulfills` noul question per listing (concurrency `JEV_SPEC_CONCURRENCY`, timeout `JEV_SPEC_TIMEOUT_MS`, raw truncated to 2000 chars).
 - `DeterministicSpecScorer`: fallback; token/keyword match + GPU compare (±5, weight from `RANKING_SIGNAL_WEIGHTS`) + numeric/excluded-term penalties, batch-scaled 1–100.
 - `SpecScoreService` (`getSpecScoreService`): primary, fallback on missing key / error / partial map.

## Ranking (`src/lib/ranking.ts`)

 - `rankProductsUnified(products, specScores, rerankScores?)`: pure ranking over precomputed scores — value scale, hybrid weights, `Condition:` reason, tags, sort.

## Aggregation (`src/lib/aggregate.ts`)

- Flat from groups → `normalizeTitle` + price key (keep cheapest) → `marketplace:id` dedup.

## Schemas (`src/lib/schemas.ts`)

- `DerivedSpecSchema`, `MarketplaceQuerySchema`, `RawProductSchema`, `RankedProductSchema`, `SearchResultSchema`, `SearchRequestSchema` (zod, `.strict()`).

## Errors (`src/lib/errors.ts`)

- `ValidationError`, `SpecDerivationError`, `MarketplaceError`.
