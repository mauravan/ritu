import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { DerivedSpec, RawProduct } from "../types";

export type RerankResult = {
  id: string;
  relevance: number; // 0-100
  relevant: boolean;
  reason: string;
};

export const RerankSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      relevance: z.number().min(0).max(100),
      relevant: z.boolean(),
      reason: z.string().max(150),
    }),
  ),
});

const RERANK_SYSTEM_PROMPT = `You rank products by relevance to the user's intent and provide a RANKING REASON for each.

Rules:
- Accessories that contain the category word but are NOT the product itself are IRRELEVANT. Example: "laptop sleeve", "laptop hülle", "laptop cover", "laptop tasche" for intent "laptop" → relevant=false, relevance 5, reason "Ranking: accessory, excluded from ranking".
- For relevant products, give a RANKING REASON explaining why it fits: mention matching requirements, specs, price efficiency, or condition (max 150 chars). Example: "Ranking: matches i5/16GB requirements well; strong value at CHF 500".
- Score relevance 0-100: 90-100 highly relevant, 60-89 somewhat relevant, 30-59 weakly relevant, 0-29 irrelevant.
- Be strict: if product is an accessory, part, cover, case, sleeve, bag, charger, dock, keyboard cover for the category, mark irrelevant.
- Return relevance and relevant consistently (relevant false if relevance <30, true otherwise) but use explicit relevant field.
- Keep reason short (max 150 chars).

Example for intent "laptop":
- "Lenovo ThinkPad T14 i5 16GB 512GB SSD" → relevant true, relevance 95, reason "Ranking: excellent spec match (i5, 16GB, SSD); top-tier laptop"
- "Laptop Sleeve 15 Zoll Hülle Tasche" → relevant false, relevance 5, reason "Ranking: accessory sleeve/hülle, excluded"
- "Laptop Cover Case Schutz" → relevant false, relevance 8, reason "Ranking: accessory cover/case, excluded"
`;

export function getRerankConfig() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseURL =
    process.env.LLM_RERANK_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_RERANK_MODEL || process.env.LLM_MODEL || "openai/gpt-4o-mini";
  const timeoutMs =
    parseInt(process.env.LLM_RERANK_TIMEOUT_MS || process.env.LLM_RERANK_TIMEOUT || "15000", 10) ||
    15000;
  const maxBatch = parseInt(process.env.LLM_RERANK_MAX_BATCH || "40", 10) || 40;
  return { apiKey, baseURL, model, timeoutMs, maxBatch };
}

export async function rerankWithLLM(
  products: RawProduct[],
  spec: DerivedSpec,
): Promise<Map<string, RerankResult>> {
  if (products.length === 0) return new Map();

  const config = getRerankConfig();
  if (!config) {
    console.log("[RITU][RANK] LLM rerank skipped — no LLM_API_KEY");
    return new Map();
  }
  const { apiKey, baseURL, model, timeoutMs, maxBatch } = config;

  // Cap and truncate
  const capped = products.slice(0, maxBatch);
  const items = capped.map((p) => ({
    id: p.id,
    title: p.title.slice(0, 120),
  }));

  const userPrompt = `User intent: category="${spec.category}" — ${spec.summary}. Requirements: ${spec.requirements.map((r) => `${r.key}:${r.value}(${r.importance})`).join(", ") || "none"}. Classify each product title as RELEVANT or IRRELEVANT and provide a RANKING REASON (why this product fits or does not fit). Accessories that contain the category word but are not the product itself (e.g. laptop sleeve for laptop) are IRRELEVANT. Score relevance 0-100.

Products:
${items.map((it) => `- id=${JSON.stringify(it.id)} title=${JSON.stringify(it.title)}`).join("\n")}`;

  const t0 = Date.now();
  try {
    const openai = createOpenAI({ apiKey, baseURL });

    const generatePromise = generateObject({
      model: openai(model),
      schema: RerankSchema,
      system: RERANK_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
    });

    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`LLM rerank timeout ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    let object: Awaited<typeof generatePromise>["object"];
    try {
      const result = (await Promise.race([generatePromise, timeoutPromise])) as Awaited<
        typeof generatePromise
      >;
      object = result.object;
    } finally {
      clearTimeout(timeoutId);
    }
    const map = new Map<string, RerankResult>();
    for (const r of object.results) {
      map.set(r.id, {
        id: r.id,
        relevance: Math.max(0, Math.min(100, r.relevance)),
        relevant: r.relevant,
        reason: r.reason,
      });
    }
    console.log(
      `[RITU][RANK] LLM rerank ok ${map.size}/${capped.length} model=${model} baseURL=${baseURL} timeout=${timeoutMs}ms category="${spec.category}" elapsed=${Date.now() - t0}ms`,
    );
    if (map.size === 0 && capped.length > 0) {
      console.warn(
        `[RITU][RANK] LLM rerank returned 0/${capped.length} — possible model/schema mismatch model=${model} baseURL=${baseURL} category="${spec.category}" elapsed=${Date.now() - t0}ms`,
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
    const base = `[RITU][RANK] LLM rerank failed category="${spec.category}" model=${model} baseURL=${baseURL} timeout=${timeoutMs}ms batch=${capped.length}/${products.length} elapsed=${elapsed}ms sampleIds=[${sampleIds}] error=${msg}`;
    if (msg.includes("timeout")) {
      console.warn(
        `${base} stack=${stack} Hint: set LLM_RERANK_MODEL to a faster model (e.g. openai/gpt-4o-mini) or increase LLM_RERANK_TIMEOUT_MS.`,
      );
    } else {
      console.warn(`${base} stack=${stack}`);
    }
    return new Map();
  }
}

