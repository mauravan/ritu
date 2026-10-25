import { NextResponse } from "next/server";
import { sanitizeSearchQueries } from "@/lib/accessoryGuard";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { filterByDistance } from "@/lib/geo";
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
  const { query, platform, locale, zipCode, radius } = parsed.data;

  let spec: DerivedSpec;
  try {
    spec = await deriveSpecs(query, locale);
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
  const derived = augmentSearchQueries(spec.searchQueries, spec);
  // Always search the user's original phrasing, plus any derived variants.
  const original = query.trim();
  const searchQueries = derived.some((q) => q.toLowerCase() === original.toLowerCase())
    ? derived
    : [original, ...derived];

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
