import pLimit from "p-limit";
import type { DerivedSpec, RawProduct } from "../types";
import type { SpecScoreResult, SpecScorer } from "./SpecScorer";

export const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
export const DEFAULT_MODEL = "typesafe/jev-1.13";
export const RAW_MAX_CHARS = 2000;

function parseEnvInt(value: string | undefined, def: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export class JevSpecScorer implements SpecScorer {
  async score(products: RawProduct[], spec: DerivedSpec): Promise<Map<string, SpecScoreResult>> {
    const result = new Map<string, SpecScoreResult>();
    if (products.length === 0) return result;

    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY missing");
    const model = process.env.JEV_MODEL || DEFAULT_MODEL;
    const concurrency = parseEnvInt(process.env.JEV_SPEC_CONCURRENCY, 4);
    const timeoutMs = parseEnvInt(process.env.JEV_SPEC_TIMEOUT_MS, 15000);
    const limit = pLimit(concurrency);

    const entries = await Promise.all(
      products.map((p) =>
        limit(async (): Promise<[string, SpecScoreResult]> => {
          const res = await fetch(DECISIONS_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              model,
              state: {
                requirements: spec.requirements.map((r) => ({
                  key: r.key,
                  value: r.value,
                  importance: r.importance,
                })),
                excludedTerms: spec.excludedTerms ?? [],
                listing: {
                  title: p.title,
                  condition: p.condition,
                  raw: JSON.stringify(p.raw ?? "").slice(0, RAW_MAX_CHARS),
                },
              },
              questions: {
                fulfills: {
                  type: "noul",
                  instructions:
                    "Does this marketplace listing fulfill the user's requirements and respect the exclusions?",
                  criteria: {
                    true: "The listing meets every 'required' requirement, meets 'preferred' requirements where stated, and does not contain or describe any excluded term.",
                    false:
                      "The listing misses one or more 'required' requirements, or contains/describes an excluded term.",
                  },
                },
              },
            }),
          });
          if (!res.ok) throw new Error(`Jev spec scoring failed: status ${res.status}`);
          const data = (await res.json()) as {
            answers?: { fulfills?: { type?: unknown; noul?: unknown } };
          };
          const answer = data.answers?.fulfills;
          const noul = answer?.noul;
          if (answer?.type !== "noul" || typeof noul !== "number" || noul < 0 || noul > 1)
            throw new Error("Jev spec scoring failed: missing/invalid noul");
          const specScore = Math.max(1, Math.min(100, Math.round(noul * 100)));
          return [p.id, { specScore, matchedRequirements: [], reasons: [] }];
        }),
      ),
    );
    for (const [id, r] of entries) result.set(id, r);
    if (result.size !== products.length)
      throw new Error(
        `Jev spec scoring incomplete: ${result.size}/${products.length}`,
      );
    return result;
  }
}
