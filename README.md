# RITU — Find anything

Single-page website that takes natural-language input, derives hardware specs via LLM, fans out search queries to **ricardo.ch** and **tutti.ch**, aggregates results, ranks by spec-match vs price, and displays four sections: original term, derived spec, marketplace queries, ranked products.

## Prerequisites

- Node 20+ (Node 26 also works, but use 20 for prod)
- `LLM_API_KEY` (OpenRouter or OpenAI)

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
npm run dev    # http://localhost:3000
```

## Architecture

```
Browser → Next.js 16 (App Router)
  POST /api/search  →  deriveSpecs (LLM) → fan-out searchRicardo/tutti (p-limit 1 for tutti, 30s timeout) → aggregate → rank → SearchResult
```

- `src/lib/llm` — single LLM call
- `src/lib/marketplaces` — ricardo fetch JSON API, tutti fetch via tutti-api
- `src/lib/ranking.ts` — pure specScore/valueScore + tags
- `src/app/api/search` — orchestrator (only place composing all)

See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for UI design tokens, typography, layout rules, and instructions on adding new search filters.
## Known limitations

- No DB — stateless per-request
- No caching — stateless per-request

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — serve build
- `npm test` — vitest run
- `npm run lint` — biome 
## Ideas
- let the llm get the requirements and then let the user choose and change
- let the user interact more with the llm. as in: let the user chat until ready to search
- make it seem more responsive by showing the derived spec before loading results
- let the user sort by value, spec and 
- use an actual rerank model like cohere rerank 4
- proximity filter
