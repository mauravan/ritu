# Architecture

## Pipeline (`POST /api/search`)

Browser → `src/app/api/search/route.ts`

1. Parse `SearchRequestSchema` (query 3–500 chars, platform `both`/`ricardo`/`tutti`, locale, optional zip/radius).
2. Jev gate: `decideSearchAction` (`src/lib/jev/decideSearch.ts`) asks `typesafe/jev-1.13` via the OpenRouter Decisions API whether the query is specific enough to search directly. On "clarify", `askClarifyingQuestion` (`src/lib/llm/askClarifying.ts`) returns `{ clarifyingQuestion }` without searching; on "search" (or any Jev failure) the flow continues. Env: `LLM_API_KEY`, `JEV_MODEL`, `JEV_SEARCH_THRESHOLD` (default 0.5).
3. Derive specs: `deriveSpecs` (`src/lib/llm/deriveSpecs.ts`) — structured `generateObject` against `DerivedSpecSchema`, fallback to `generateText` + manual JSON parse. Throws `ValidationError` (bad input <3 chars) or `SpecDerivationError`.
4. Accessory guard: sanitize `searchQueries` dropping terms matching accessory set (`hülle`, `huelle`, `tasche`, `sleeve`, `cover`, `case`, `halterung`, `schutz`, `folie`, `ständer`, `staender`) unless category is accessory-related; restore original if all dropped, else fall back to `[spec.category]`.
5. Fan-out queries: `searchQueries.flatMap` → `MarketplaceQuery[]` (`ricardo` and/or `tutti`) with `buildRicardoUrl` / `buildTuttiUrl`.
6. Parallel fetch: `Promise.allSettled` for `searchRicardo` / `searchTutti` (20 limit each). Rejected excluded; fulfilled aggregated.
7. Aggregate: `aggregate` (`src/lib/aggregate.ts`) — dedup by `normalizeTitle(title)|priceChf` (keep cheapest), then by `marketplace:id`.
8. LLM rerank (optional): `rerankWithLLM` (`src/lib/llm/rerank.ts`) — `generateObject` with `RerankSchema`, capped at `LLM_RERANK_MAX_BATCH` (default 40), timeout 15000ms; returns `Map<id, RerankResult>`. Empty or error falls back to deterministic ranking.
9. Rank: `rankProductsUnified` (`src/lib/ranking.ts`) — `specScore` (keyword/token match + signal bonuses), `valueScore` (spec / price), scaled 1–100; hybrid `0.35 spec + 0.25 value + LLM weight` (LLM present: weight = `1 - 0.35 - 0.25`; else weights redistribute to 0.6/0.4). Sort by hybrid → value → spec.
10. Tags (`Tag`): `best specs` (max spec), `best value` (max value, different index preferred), `cheapest` (price < others with spec ≥40), `best condition` (`new`/`neu` with spec ≥50), `balanced` (harmonic mean among untagged, ≥4 products), `best overall` (max hybrid, untagged preferred). `signalRegistry` holds `gpu` signal (compare via series/model, ±5).
11. Return `SearchResultSchema`: input, derivedSpec, queries, products (max 40), platform. Clarify path returns `{ clarifyingQuestion }` instead.

## LLM modules (`src/lib/llm/`)

- `deriveSpecs`: structured validation (`DerivedSpecSchema`). Env: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
- `rerank`: relevance scoring (`RerankSchema`), strict accessory exclusion. Env: `LLM_API_KEY`, `LLM_RERANK_BASE_URL`, `LLM_RERANK_MODEL`, `LLM_RERANK_TIMEOUT_MS`, `LLM_RERANK_MAX_BATCH`, `LLM_RERANK_TIMEOUT`.
- `askClarifying`: one concise question (`ClarifyingQuestionSchema`). Env: same as deriveSpecs.
- `prompt.ts`: `SYSTEM_PROMPT` for deriveSpecs.

## Marketplace adapters (`src/lib/marketplaces/`)

- `ricardo`: `RicardoClient` (`ricardo-api` library) mobile endpoint `/m/search` with AWS SigV4 (`x-authorization`). No web cookies (cause 403 WAF). Price parsed from `buyNowPrice`/`bidPrice` (divided by 100), image from `images[0].rendition.src` (replaces `t_265x200` with `t_800x600`). URL built from slugified title + id.
- `tutti`: `tutti-api` (`TuttiClient`) GraphQL only (no Playwright fallback). `searchTuttiViaApi` with 8000ms race timeout; parses `formattedPrice` (CHF-prefixed or `650.-` form) via regex. Normalizes image URL (`//` → `https:`, `/` → `https://www.tutti.ch`). Throws on 429/1015 for retry. Env rate limits apply.
- `index.ts`: `MarketplaceAdapter` interface (`search`, `buildUrl`).

## Ranking (`src/lib/ranking.ts`)

- `keywordsFromSpec`: tokenizes requirements + queries + category (stopwords removed).
- `signalRegistry`: `gpu` registered; extensible (`RankingSignal`: `select`, `score`, `compare`). Weights from `RANKING_SIGNAL_WEIGHTS` env JSON.
- `rankProductsUnified`: computes `specScore`, `valueScore`, scaled; applies compare signals; computes hybrid; tags; sorts.

## Aggregation (`src/lib/aggregate.ts`)

- Flat from groups → `normalizeTitle` + price key (keep cheapest) → `marketplace:id` dedup.

## Schemas (`src/lib/schemas.ts`)

- `DerivedSpecSchema`, `MarketplaceQuerySchema`, `RawProductSchema`, `RankedProductSchema`, `SearchResultSchema`, `SearchRequestSchema` (zod, `.strict()`).

## Errors (`src/lib/errors.ts`)

- `ValidationError`, `SpecDerivationError`, `MarketplaceError`.
