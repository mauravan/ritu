import { logger } from "../logger";
import type { DerivedSpec, RawProduct } from "../types";

export type RerankResult = {
  id: string;
  relevance: number; // 0-100, derived from relevance_score * 100
};

export function getRerankConfig() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseURL =
    process.env.LLM_RERANK_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_RERANK_MODEL || "voyageai/rerank-2.5";
  const timeoutMs =
    parseInt(process.env.LLM_RERANK_TIMEOUT_MS || process.env.LLM_RERANK_TIMEOUT || "15000", 10) ||
    15000;
  const maxBatch = parseInt(process.env.LLM_RERANK_MAX_BATCH || "40", 10) || 40;
  return { apiKey, baseURL, model, timeoutMs, maxBatch };
}

function buildRerankQuery(spec: DerivedSpec): string {
  const reqs = spec.requirements.map((r) => `${r.key}: ${r.value} (${r.importance})`).join(", ");
  return `${spec.category}: ${spec.summary}${reqs ? ` Requirements: ${reqs}` : ""}`;
}

export async function rerankWithModel(
  products: RawProduct[],
  spec: DerivedSpec,
): Promise<Map<string, RerankResult>> {
  if (products.length === 0) return new Map();

  const config = getRerankConfig();
  if (!config) {
    logger.info("[RITU][RANK] rerank skipped — no LLM_API_KEY");
    return new Map();
  }
  const { apiKey, baseURL, model, timeoutMs, maxBatch } = config;

  // Cap and truncate
  const capped = products.slice(0, maxBatch);
  const items = capped.map((p) => ({
    id: p.id,
    title: p.title.slice(0, 120),
  }));
  const query = buildRerankQuery(spec);

  const t0 = Date.now();
  try {
    const res = await fetch(`${baseURL}/rerank`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        query,
        documents: items.map((it) => it.title),
        top_n: items.length,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`rerank HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      results?: { index: number; relevance_score?: number }[];
    };
    const map = new Map<string, RerankResult>();
    for (const r of data.results ?? []) {
      const item = items[r.index];
      if (!item) continue;
      const relevance = Math.max(0, Math.min(100, Math.round((r.relevance_score ?? 0) * 100)));
      map.set(item.id, { id: item.id, relevance });
    }
    logger.info(
      `[RITU][RANK] rerank ok ${map.size}/${capped.length} model=${model} baseURL=${baseURL} category="${spec.category}" elapsed=${Date.now() - t0}ms`,
    );
    if (map.size === 0 && capped.length > 0) {
      logger.warn(
        `[RITU][RANK] rerank returned 0/${capped.length} — possible model mismatch model=${model} baseURL=${baseURL} category="${spec.category}" elapsed=${Date.now() - t0}ms`,
      );
    }
    return map;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack =
      err instanceof Error ? (err.stack?.split("\n").slice(0, 3).join(" | ") ?? "") : "";
    const elapsed = Date.now() - t0;
    const sampleIds = capped
      .slice(0, 2)
      .map((p) => p.id)
      .join(",");
    const base = `[RITU][RANK] rerank failed category="${spec.category}" model=${model} baseURL=${baseURL} timeout=${timeoutMs}ms batch=${capped.length}/${products.length} elapsed=${elapsed}ms sampleIds=[${sampleIds}] error=${msg}`;
    if (err instanceof Error && err.name === "TimeoutError") {
      logger.warn(
        `${base} stack=${stack} Hint: increase LLM_RERANK_TIMEOUT_MS or use voyageai/rerank-2.5-lite.`,
      );
    } else {
      logger.warn(`${base} stack=${stack}`);
    }
    return new Map();
  }
}

export async function runOptionalRerank(
  raw: RawProduct[],
  spec: DerivedSpec,
): Promise<Map<string, RerankResult> | undefined> {
  if (!process.env.LLM_API_KEY) {
    logger.info("[RITU][RANK] rerank skipped — no LLM_API_KEY");
    return undefined;
  }
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
    logger.info(
      `[RITU][RANK] rerank start deterministic=${raw.length} batch=${toRerank.length}/${raw.length} maxBatch=${maxBatch} model=${cfg?.model ?? "unknown"} baseURL=${cfg?.baseURL ?? "unknown"} timeoutMs=${cfg?.timeoutMs ?? 15000} category="${spec.category}"`,
    );
    const rerankScores = await rerankWithModel(toRerank, spec);
    const elapsed = Date.now() - tRerank0;
    if (!rerankScores || rerankScores.size === 0) {
      logger.warn(
        `[RITU][RANK] rerank yielded 0/${toRerank.length} (empty map) — falling back to deterministic. deterministic=${raw.length} maxBatch=${maxBatch} model=${cfg?.model} baseURL=${cfg?.baseURL} timeoutMs=${cfg?.timeoutMs} category="${spec.category}" elapsed=${elapsed}ms specSummary="${spec.summary.slice(0, 80)}"`,
      );
    } else {
      logger.info(
        `[RITU][RANK] rerank done ${rerankScores.size}/${toRerank.length} elapsed=${elapsed}ms category="${spec.category}"`,
      );
    }
    return rerankScores;
  } catch (e) {
    const elapsed = Date.now() - tRerank0;
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack?.split("\n").slice(0, 4).join(" | ") ?? "") : "";
    const errName = e instanceof Error ? e.name : typeof e;
    logger.warn(
      `[RITU][RANK] rerank failed — outer catch, using deterministic. deterministic=${raw.length} maxBatch=${maxBatch} model=${cfg?.model} baseURL=${cfg?.baseURL} timeoutMs=${cfg?.timeoutMs} category="${spec.category}" specSummary="${spec.summary.slice(0, 80)}" elapsed=${elapsed}ms error=${errName}: ${msg} stack=${stack}`,
    );
    return undefined;
  }
}
