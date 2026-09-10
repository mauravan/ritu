import { NextResponse } from "next/server";
import { aggregate } from "@/lib/aggregate";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { askClarifyingQuestion } from "@/lib/llm/askClarifying";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { getRerankConfig, rerankWithLLM } from "@/lib/llm/rerank";
import { buildRicardoUrl, searchRicardo } from "@/lib/marketplaces/ricardo";
import { buildTuttiUrl, searchTutti } from "@/lib/marketplaces/tutti";
import { rankProductsUnified } from "@/lib/ranking";
import { SearchRequestSchema } from "@/lib/schemas";
import type { DerivedSpec, MarketplaceQuery, RawProduct, SearchResult } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const query = parsed.data.query;
  const platform = parsed.data.platform ?? "both";
  const askQuestion = parsed.data.askQuestion ?? false;
  const clarifyingAnswer = parsed.data.clarifyingAnswer;
  const clarifyingQuestion = parsed.data.clarifyingQuestion;
  const originalQuery = parsed.data.originalQuery || query;
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
      // graceful fallback: proceed as if askQuestion was false
    }
  }
  let spec: DerivedSpec;
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

  // Defense in depth: sanitize searchQueries that leaked accessory terms
  {
    const accessoryGuard = new Set([
      "hülle",
      "huelle",
      "tasche",
      "sleeve",
      "cover",
      "case",
      "halterung",
      "schutz",
      "folie",
      "ständer",
      "staender",
    ]);
    const categoryLower = spec.category.toLowerCase();
    const isAccessoryCategory = Array.from(accessoryGuard).some((w) => categoryLower.includes(w));
    if (!isAccessoryCategory) {
      const before = spec.searchQueries.length;
      const originalQueries = [...spec.searchQueries];
      const excludedSet = new Set(spec.excludedTerms.map((t) => t.toLowerCase()));
      spec.searchQueries = spec.searchQueries.filter((q) => {
        const qLower = q.toLowerCase();
        if (excludedSet.has(qLower)) return false;
        const tokens = qLower.split(/[^a-z0-9]+/g).filter(Boolean);
        for (const tok of tokens) {
          if (accessoryGuard.has(tok)) {
            console.log(
              `[RITU][SEARCH] dropping accessory query "${q}" for category "${spec.category}"`,
            );
            return false;
          }
        }
        return true;
      });
      if (spec.searchQueries.length === 0 && before > 0) {
        console.warn(`[RITU][SEARCH] all queries dropped by accessory guard, restoring original`);
        spec.searchQueries = originalQueries;
      }
      if (spec.searchQueries.length === 0) {
        spec.searchQueries = [spec.category];
      }
    }
  }

  const queries: MarketplaceQuery[] = spec.searchQueries.flatMap((q) => {
    const arr: MarketplaceQuery[] = [];
    if (platform === "both" || platform === "ricardo")
      arr.push({ marketplace: "ricardo" as const, query: q, url: buildRicardoUrl(q) });
    if (platform === "both" || platform === "tutti")
      arr.push({ marketplace: "tutti" as const, query: q, url: buildTuttiUrl(q) });
    return arr;
  });
  console.log(
    `[RITU][SEARCH] fanout ${queries.length} queries: ${queries.map((q) => `${q.marketplace}:${q.query}`).join(" | ")}`,
  );
  const _t0 = Date.now();

  const ricardoPromises =
    platform === "both" || platform === "ricardo"
      ? spec.searchQueries.map((q) => searchRicardo(q, 20))
      : ([] as Promise<RawProduct[]>[]);
  const tuttiPromises =
    platform === "both" || platform === "tutti"
      ? spec.searchQueries.map((q) => searchTutti(q, 20))
      : ([] as Promise<RawProduct[]>[]);

  const ricardoSettled = await Promise.allSettled(ricardoPromises);
  const tuttiSettled = await Promise.allSettled(tuttiPromises);

  const ricardoFulfilled = ricardoSettled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<RawProduct[]>).value);
  const ricardoRejected = ricardoSettled
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason);

  const tuttiFulfilled = tuttiSettled
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<RawProduct[]>).value);
  const tuttiRejected = tuttiSettled
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason);

  const ricardoGroups = ricardoFulfilled;
  const tuttiGroups = tuttiFulfilled;

  // Handle individual rejections (aggregate behavior unchanged; rejected promises excluded from results)
  for (const rej of ricardoRejected) {
    console.error("[RITU][SEARCH] ricardo promise rejected:", rej);
  }
  for (const rej of tuttiRejected) {
    console.error("[RITU][SEARCH] tutti promise rejected:", rej);
  }
  const ricardoFlat = ricardoGroups.flat();
  const tuttiFlat = tuttiGroups.flat();
  const raw = aggregate([...ricardoGroups, ...tuttiGroups]);
  console.log(
    `[RITU][SEARCH] aggregate raw=${raw.length} (ricardo ${ricardoFlat.length}+tutti ${tuttiFlat.length} -> dedup ${raw.length})`,
  );
  // Sanitize searchQueries that leaked accessory terms (defense in depth) — log if any query looks like accessory
  // (LLM should already exclude them via prompt; this is guard only — queries already executed above)

  console.log(`[RITU][SEARCH] deterministic ranked=${raw.length}`);

  // AI rerank (optional, non-blocking fallback)
  let llmScores: Map<string, import("@/lib/llm/rerank").RerankResult> | undefined;
  if (process.env.LLM_API_KEY) {
    const cfg = getRerankConfig();
    const maxBatch = cfg?.maxBatch ?? 40;
    const tRerank0 = Date.now();
    try {
      const toRerank: RawProduct[] = raw.slice(0, maxBatch).map((r) => ({
        id: r.id,
        title: r.title,
        marketplace: r.marketplace,
        priceChf: r.priceChf,
        currency: "CHF" as const,
        condition: r.condition,
        imageUrl: r.imageUrl,
        url: r.url,
        location: r.location,
        raw: r.raw,
      }));
      console.log(
        `[RITU][RANK] LLM rerank start deterministic=${raw.length} batch=${toRerank.length}/${raw.length} maxBatch=${maxBatch} model=${cfg?.model ?? "unknown"} baseURL=${cfg?.baseURL ?? "unknown"} timeoutMs=${cfg?.timeoutMs ?? 15000} category="${spec.category}"`,
      );
      llmScores = await rerankWithLLM(toRerank, spec);
      const elapsed = Date.now() - tRerank0;
      if (!llmScores || llmScores.size === 0) {
        console.warn(
          `[RITU][RANK] LLM rerank yielded 0/${toRerank.length} (empty map) — falling back to deterministic. deterministic=${raw.length} maxBatch=${maxBatch} model=${cfg?.model} baseURL=${cfg?.baseURL} timeoutMs=${cfg?.timeoutMs} category="${spec.category}" elapsed=${elapsed}ms specSummary="${spec.summary.slice(0, 80)}"`,
        );
      } else {
        console.log(
          `[RITU][RANK] LLM rerank done ${llmScores.size}/${toRerank.length} elapsed=${elapsed}ms category="${spec.category}"`,
        );
      }
    } catch (e) {
      const elapsed = Date.now() - tRerank0;
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? (e.stack?.split("\n").slice(0, 4).join(" | ") ?? "") : "";
      const errName = e instanceof Error ? e.name : typeof e;
      console.warn(
        `[RITU][RANK] LLM rerank failed — outer catch, using deterministic. deterministic=${raw.length} maxBatch=${maxBatch} model=${cfg?.model} baseURL=${cfg?.baseURL} timeoutMs=${cfg?.timeoutMs} category="${spec.category}" specSummary="${spec.summary.slice(0, 80)}" elapsed=${elapsed}ms error=${errName}: ${msg} stack=${stack}`,
      );
    }
  } else {
    console.log("[RITU][RANK] LLM rerank skipped — no LLM_API_KEY");
  }
  const products = rankProductsUnified(raw, spec, llmScores).slice(0, 40);
  console.log(
    `[RITU][SEARCH] ranked=${products.length} top3: ${products
      .slice(0, 3)
      .map(
        (p) =>
          `"${p.title.slice(0, 40)}" hybrid=\${p.hybridScore ?? p.specScore} img=${p.imageUrl?.slice(0, 60) ?? "null"}`,
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
