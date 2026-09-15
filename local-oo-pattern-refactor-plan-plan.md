# OO Pattern Refactor Plan — src/lib/

## Context

Refactor `src/lib/` from procedural/functional modules into a pattern-driven design. Scope excludes `src/app/`, `src/lib/llm/` (already structured), and tests remain untouched except for contract preservation. Patterns selected by user: Factory/Abstract Factory, Strategy, Singleton, Adapter, Decorator, Observer, Builder. Goal: pattern-driven modularity (not pure class-based OO). All patterns must be documented: inline JSDoc (participant roles, intent, collaboration) + new docs (`docs/patterns.md`).

## Approach

Ordered by dependency; each step produces verifiable module structure. Do not invent patterns where no collaboration exists — document absence explicitly.

### 1. Singleton — Logger & Registry
- File: `src/lib/logger.ts`
- Change: Wrap `pino` instance in `Logger` class with `getInstance()`; expose same `debug/info/warn/error` interface. Document participant roles (Client, Singleton, Logger Instance).
- File: `src/lib/ranking.ts`
- Change: Convert `signalRegistry` (`Map<string, RankingSignal>`) into `SignalRegistry` Singleton class with `register()`, `get()`, `list()`. Preserve `ranking.ts` callers (`signalRegistry.set` -> `SignalRegistry.getInstance().register`).
- File: `src/lib/marketplaces/rateLimit.ts`
- Change: Formalize `RateLimitConfig` as Singleton; keep `parseEnvInt` as private helper. Document singleton access point.
- Inline docs: `/** Singleton — ensures single logger instance across modules. */`

### 2. Adapter — Marketplace & Proxy Fetch
- File: `src/lib/marketplaces/index.ts`
- Change: `MarketplaceAdapter` interface stays (Target). Create abstract `MarketplaceAdapterImpl` base class. Convert `ricardo.ts` (`RicardoAdapter`) and `tutti.ts` (`TuttiAdapter`) into concrete Adapter classes implementing interface. Document Adaptee (`ricardo-api` / `tutti-api`) vs Adapter (`RicardoAdapter` / `TuttiAdapter`).
- File: `src/lib/proxyFetch.ts`
- Change: Create `ProxyFetchAdapter` class implementing standard `fetch` contract (`RequestInfo | URL`, `RequestInit`). Document adapted interface (`global.fetch`) and adapter behavior (proxy rotation, agent creation).
- Inline docs: JSDoc `@pattern Adapter` on adapter classes.

### 3. Factory / Abstract Factory — Marketplace Adapter Creation
- File: `src/lib/marketplaces/factory.ts` (new)
- Change: Create `MarketplaceAdapterFactory` abstract factory with `createAdapter(name: "ricardo" | "tutti"): MarketplaceAdapter`. Create concrete `StandardMarketplaceFactory`. Update callers in `searchMarketplaces.ts` to use factory instead of direct imports (`new StandardMarketplaceFactory().createAdapter("ricardo")`).
- Document abstract factory (Creator, ConcreteCreator, Product, Client) in `docs/patterns.md` and inline.
- Dependency: Step 2 (Adapter) must complete first.

### 4. Strategy — Ranking & Numeric Filter
- File: `src/lib/ranking.ts`
- Change: Extract ranking algorithms (`keyword/token scoring`, `gpu` signal) into `RankingStrategy` interface with `execute(spec, product): ScoreResult`. Create concrete strategies: `KeywordStrategy`, `GpuStrategy`, `ValueStrategy`. Update `rankProductsUnified` to compose strategies (Strategy Pattern + Composite). Document context (`rankProductsUnified`), strategy interface, concrete implementations, and client collaboration.
- File: `src/lib/numericFilter.ts`
- Change: Extract `NumericFilterStrategy` interface; concrete `ExactFilterStrategy`, `RangeFilterStrategy`, `GreaterThanStrategy`, `LessThanStrategy`. `findBestNumeric` becomes context that selects strategy based on `operator`. Preserve behavior exactly.
- Inline docs: `@implements RankingStrategy`, `@param context` for composition code.

### 5. Decorator — Filter & Query Guards
- File: `src/lib/accessoryGuard.ts`
- Change: Create `SearchQueryDecorator` abstract class wrapping `string[]`. Concrete `AccessoryGuardDecorator` applies existing `sanitizeSearchQueries` logic. Document decorator component (Component, ConcreteComponent, Decorator, ConcreteDecorator) and transparency (decorator preserves `string[]` interface to callers).
- File: `src/lib/searchMarketplaces.ts`
- Change: Optionally decorate marketplace query generation with `RateLimitDecorator` (decorates `search` function with throttle/retry). Only add if it simplifies current `withRicardoLimit` / `withTuttiLimit` usage. If it adds indirection without value, document why Decorator is omitted here (decision recorded in docs).
- Inline docs: `@pattern Decorator` on decorator classes.

### 6. Builder — Spec & Filter Object Construction
- File: `src/lib/schemas.ts` / `parseRequirementValue.ts`
- Change: Create `DerivedSpecBuilder` with `setCategory`, `addRequirement`, `setSearchQueries`, `build(): DerivedSpec`. Update any construction points in `searchMarketplaces.ts` or future callers to use builder. Document Director (if needed) and Builder steps in `docs/patterns.md`.
- File: `src/lib/numericFilter.ts`
- Change: Create `NumericFilterBuilder` for step-by-step filter criteria (`value`, `unit`, `operator`). Preserve all parsing logic in `parseRequirementValue` as parser/lexer, not builder.
- Dependency: None new; independent.

### 7. Observer — Registry & Ranking Updates
- Note: No existing observer mechanism in `src/lib/`. Force-applying Observer creates artificial coupling. Decision: document Observer application as potential, not mandatory.
- If user requires explicit Observer: create `RankingObserver` interface (`update(product: RawProduct)`), `RankingSubject` class in `ranking.ts`, and register `signalRegistry` as observer. Otherwise document absence.
- Default (safe): Skip forced Observer unless user confirms. Record in docs: "Observer — not applied; no state-change propagation requirement found. Can be added to `signalRegistry` or `RankingSubject` when needed."

## Critical Files & Anchors

- `src/lib/marketplaces/index.ts` — Adapter interface definition; must stay unchanged contract.
- `src/lib/ranking.ts` — `RankingSignal` interface, `signalRegistry` Singleton, `rankProductsUnified` Strategy context. Lines ~155-220.
- `src/lib/proxyFetch.ts` — Adapter target (`global.fetch`) and proxy agent logic.
- `src/lib/searchMarketplaces.ts` — Factory clients (`buildMarketplaceQueries`, `augmentSearchQueries`); must use factory, not direct adapter imports.
- `docs/ARCHITECTURE.md` — Existing architecture reference; new `docs/patterns.md` must reference it for collaboration diagrams.

## Verification

After each step above, run:
```bash
cd /home/mauravan/Work/ritu
npm run test -- --run src/lib/ranking.test.ts src/lib/numericFilter.ts src/lib/proxyFetch.test.ts src/lib/searchMarketplaces.test.ts
```
Tests must pass without contract change. End-to-end verification: build TypeScript (`npx tsc --noEmit`) and confirm `docs/patterns.md` documents all 7 selected patterns with participant roles.

Verification commands (run after full refactor):
```bash
npm run test -- --run
npx tsc --noEmit
cat docs/patterns.md | grep -E "(Singleton|Adapter|Factory|Strategy|Decorator|Observer|Builder)" | wc -l  # expect >= 14 (2 per pattern minimum)
```

## Assumptions & Contingencies

- If `Observer` has no natural collaboration point, leave unimplemented and document absence in `docs/patterns.md`. Do not invent artificial subjects/observers.
- If `Decorator` adds indirection without simplifying current `withRicardoLimit` / `withTuttiLimit`, skip decorator for rate limits and document why.
- `src/lib/llm/` excluded: LLM modules already use structured objects; applying patterns there is out of scope per user selection (`src/lib/` only).
- If TypeScript compilation fails after factory introduction due to import cycles (`marketplaces/index.ts` -> `factory.ts`), break cycle by moving factory to `marketplaces/factory.ts` and importing interface only.
