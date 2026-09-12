import { NextResponse } from "next/server";
import { sanitizeSearchQueries } from "@/lib/accessoryGuard";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { askClarifyingQuestion } from "@/lib/llm/askClarifying";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { runOptionalRerank } from "@/lib/llm/rerank";
import { parseSearchRequest } from "@/lib/parseSearchRequest";
import { rankProductsUnified } from "@/lib/ranking";
import {
  augmentSearchQueries,
  buildMarketplaceQueries,
  searchMarketplaces,
} from "@/lib/searchMarketplaces";
import type { DerivedSpec, SearchResult } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  const parsed = await parseSearchRequest(req);
  if (!parsed.ok) return parsed.errorResponse;
  const { derivedSpec: providedSpec, ...rest } = parsed.data;
  const { query, platform, askQuestion, clarifyingAnswer, clarifyingQuestion, originalQuery } = rest;
  if (askQuestion === true) {
    try {
      const question = await askClarifyingQuestion(query);
      console.log(`[RITU][SEARCH] clarifying question="${question.slice(0, 140)}"`);
      return NextResponse.json({ clarifyingQuestion: question }, { status: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[RITU][SEARCH] askClarifying failed: ${msg} — falling back to direct deriveSpecs`,
      );
    }
  }
  let spec: DerivedSpec;
  if (providedSpec) {
    spec = providedSpec;
    console.log(`[RITU][SEARCH] using provided derivedSpec category=${spec.category}`);
  } else {
    try {
      spec = await deriveSpecs(query, clarifyingAnswer);
      console.log(`[RITU][SEARCH] derivedSpec=${JSON.stringify(spec)}`);
    } catch (err) {
      if (err instanceof ValidationError) {
        console.warn(`[RITU][SEARCH] validation ${err.message}`);
        return NextResponse.json(
          { error: "validation_error", details: err.message },
          { status: 400 },
        );
      }
      if (err instanceof SpecDerivationError) {
        console.warn(`[RITU][SEARCH] spec error ${err.message}`);
        return NextResponse.json(
          { error: "spec_derivation_failed", details: err.message },
          { status: 502 },
        );
      }
      throw err;
    }
  }

  spec.searchQueries = sanitizeSearchQueries(spec);
  const searchQueries = augmentSearchQueries(spec.searchQueries, spec);

  const queries = buildMarketplaceQueries(searchQueries, platform);
  console.log(
    `[RITU][SEARCH] fanout ${queries.length} queries: ${queries.map((q) => `${q.marketplace}:${q.query}`).join(" | ")}`,
  );

  // Start independent fetch early; await late
  const rawPromise = searchMarketplaces(searchQueries, platform);

  const raw = await rawPromise;

  // Parallel independent rerank
  const rerankPromise = runOptionalRerank(raw, spec);
  const llmScores = await rerankPromise;

  const products = rankProductsUnified(raw, spec, llmScores).slice(0, 40);
  console.log(
    `[RITU][SEARCH] ranked=${products.length} top3: ${products
      .slice(0, 3)
      .map(
        (p) =>
          `"${p.title.slice(0, 40)}" hybrid=${p.hybridScore ?? p.specScore} img=${p.imageUrl?.slice(0, 60) ?? "null"}`,
      )
      .join(" | ")}`,
  );
  if (raw.length !== products.length || llmScores?.size) {
    console.log(
      `[RITU][RANK] hybrid: raw ${raw.length} -> llm filtered ${llmScores?.size ?? 0} -> final ${products.length}`,
    );
  }
  if (products.length > 0)
    console.log(
      `[RITU][SEARCH] raw->ranked mapping complete, total queries=${queries.length} total products=${raw.length} ranked=${products.length}`,
    );

  const result: SearchResult = {
    input: originalQuery || query,
    derivedSpec: spec,
    queries,
    products,
    platform,
    clarifyingQuestion: clarifyingQuestion || undefined,
    clarifyingAnswer: clarifyingAnswer || undefined,
    originalQuery: originalQuery || query,
  };
  return NextResponse.json(result);
}
