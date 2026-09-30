import { NextResponse } from "next/server";
import { sanitizeSearchQueries } from "@/lib/accessoryGuard";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { filterByDistance } from "@/lib/geo";
import { decideSearchAction } from "@/lib/jev/decideSearch";
import { askClarifyingQuestion } from "@/lib/llm/askClarifying";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { runOptionalRerank } from "@/lib/llm/rerank";
import { logger } from "@/lib/logger";
import { parseSearchRequest } from "@/lib/parseSearchRequest";
import { rankProductsUnified } from "@/lib/ranking";
import {
  augmentSearchQueries,
  buildMarketplaceQueries,
  searchMarketplaces,
} from "@/lib/searchMarketplaces";
import { getSpecScoreService } from "@/lib/specScore/SpecScoreService";
import type { DerivedSpec, SearchResult } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  const parsed = await parseSearchRequest(req);
  if (!parsed.ok) return parsed.errorResponse;
  const { query, platform, locale, askedQuestions, zipCode, radius } = parsed.data;

  const MAX_CLARIFYING_QUESTIONS = 2;
  const questionsExhausted = askedQuestions.length >= MAX_CLARIFYING_QUESTIONS;
  if (questionsExhausted) {
    logger.info(
      `[RITU][SEARCH] clarifying cap reached (${askedQuestions.length}/${MAX_CLARIFYING_QUESTIONS}) — searching directly`,
    );
  }

  const decision = questionsExhausted ? "search" : await decideSearchAction(query);
  if (decision === "clarify") {
    try {
      const question = await askClarifyingQuestion(query, locale, askedQuestions);
      logger.info(`[RITU][SEARCH] clarifying question="${question.slice(0, 140)}"`);
      return NextResponse.json({ clarifyingQuestion: question }, { status: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`[RITU][SEARCH] askClarifying failed: ${msg} — falling back to direct search`);
    }
  }

  let spec: DerivedSpec;
  try {
    spec = await deriveSpecs(query, locale, askedQuestions);
    logger.info(`[RITU][SEARCH] derivedSpec=${JSON.stringify(spec)}`);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.warn(`[RITU][SEARCH] validation ${err.message}`);
      return NextResponse.json(
        { error: "validation_error", details: err.message },
        { status: 400 },
      );
    }
    if (err instanceof SpecDerivationError) {
      logger.warn(`[RITU][SEARCH] spec error ${err.message}`);
      return NextResponse.json(
        { error: "spec_derivation_failed", details: err.message },
        { status: 502 },
      );
    }
    throw err;
  }

  spec.searchQueries = sanitizeSearchQueries(spec);
  const searchQueries = augmentSearchQueries(spec.searchQueries, spec);

  const queries = buildMarketplaceQueries(searchQueries, platform);
  logger.info(
    `[RITU][SEARCH] fanout ${queries.length} queries: ${queries.map((q) => `${q.marketplace}:${q.query}`).join(" | ")}`,
  );

  // Start independent fetch early; await late (raise cap so nearby items survive one page)
  const rawPromise = searchMarketplaces(searchQueries, platform, zipCode ? 40 : 20);

  const raw = await rawPromise;
  const filtered = zipCode && radius ? filterByDistance(raw, zipCode, radius) : raw;
  logger.info(
    `[RITU][SEARCH] distance filter ${raw.length} -> ${filtered.length} (zip=${zipCode}, radius=${radius}km)`,
  );

  // Parallel independent spec scoring + rerank
  const [specOutcome, rerankScores] = await Promise.all([
    getSpecScoreService().score(filtered, spec),
    runOptionalRerank(filtered, spec),
  ]);

  const products = rankProductsUnified(filtered, specOutcome.scores, rerankScores);
  logger.info(
    `[RITU][SEARCH] ranked=${products.length} top3: ${products
      .slice(0, 3)
      .map(
        (p) =>
          `"${p.title.slice(0, 40)}" hybrid=${p.hybridScore ?? p.specScore} img=${p.imageUrl?.slice(0, 60) ?? "null"}`,
      )
      .join(" | ")}`,
  );
  if (raw.length !== products.length || rerankScores?.size) {
    logger.info(
      `[RITU][RANK] hybrid: raw ${raw.length} -> reranked ${rerankScores?.size ?? 0} -> final ${products.length}`,
    );
  }
  if (products.length > 0)
    logger.info(
      `[RITU][SEARCH] raw->ranked mapping complete, total queries=${queries.length} total products=${raw.length} ranked=${products.length}`,
    );

  const result: SearchResult = {
    input: query,
    derivedSpec: spec,
    queries,
    products,
    platform,
    specScoringSource: specOutcome.source,
  };
  return NextResponse.json(result);
}
