import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { getAuthContext } from "@/lib/auth/session";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { searchRicardo, buildRicardoUrl } from "@/lib/marketplaces/ricardo";
import { searchTutti, buildTuttiUrl } from "@/lib/marketplaces/tutti";
import { aggregate } from "@/lib/aggregate";
import { rankProducts } from "@/lib/ranking";
import { SearchRequestSchema } from "@/lib/schemas";
import { ValidationError, SpecDerivationError } from "@/lib/errors";
import type { MarketplaceQuery, RawProduct, SearchResult } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  const auth = await getAuthContext();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data.query;

  let spec;
  try {
    spec = await deriveSpecs(query);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: "validation_error", details: err.message }, { status: 400 });
    }
    if (err instanceof SpecDerivationError) {
      return NextResponse.json({ error: "spec_derivation_failed", details: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "spec_derivation_failed", details: String(err) }, { status: 502 });
  }

  const queries: MarketplaceQuery[] = spec.searchQueries.flatMap((q) => [
    { marketplace: "ricardo" as const, query: q, url: buildRicardoUrl(q) },
    { marketplace: "tutti" as const, query: q, url: buildTuttiUrl(q) },
  ]);

  // Fan-out with auth
  const limitTutti = pLimit(1);

  const ricardoPromises = spec.searchQueries.map((q) => searchRicardo(q, auth?.ricardo ?? null, 20));
  const tuttiPromises = spec.searchQueries.map((q) => limitTutti(() => searchTutti(q, auth?.tutti ?? null, 20)));

  const marketplacePhase = Promise.all([Promise.all(ricardoPromises), Promise.all(tuttiPromises)]);

  const [ricardoGroups, tuttiGroups] = await Promise.race([
    marketplacePhase,
    new Promise<[RawProduct[][], RawProduct[][]]>((resolve) =>
      setTimeout(() => resolve([[], []]), 30000),
    ),
  ]);

  const ricardoFlat = ricardoGroups.flat();
  const tuttiFlat = tuttiGroups.flat();

  // Determine authUsed
  const authUsed = {
    ricardo: !!auth?.ricardo && ricardoFlat.length > 0,
    tutti: !!auth?.tutti && tuttiFlat.length > 0,
  };

  // If auth was present but resulted in empty, log and mark not used (session expired fallback)
  if (auth?.ricardo && ricardoFlat.length === 0) {
    console.warn("[RITU] auth expired for ricardo or no results, authUsed false");
    authUsed.ricardo = false;
  }
  if (auth?.tutti && tuttiFlat.length === 0) {
    console.warn("[RITU] auth expired for tutti or no results, authUsed false");
    authUsed.tutti = false;
  }

  console.log(`[RITU] authUsed ricardo=${authUsed.ricardo} tutti=${authUsed.tutti}`);
  console.log(`[RITU] query="${query}" spec=${spec.category} ricardo=${ricardoFlat.length} tutti=${tuttiFlat.length} auth=${JSON.stringify(authUsed)}`);

  const raw = aggregate([...ricardoGroups, ...tuttiGroups]);
  const products = rankProducts(raw, spec).slice(0, 40);

  console.log(`[RITU] query="${query}" ranked=${products.length}`);

  const result: SearchResult = {
    input: query,
    derivedSpec: spec,
    queries,
    products,
    authUsed,
  };

  return NextResponse.json(result);
}
