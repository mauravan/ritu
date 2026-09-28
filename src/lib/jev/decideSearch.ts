import { logger } from "../logger";

export type SearchDecision = "search" | "clarify";

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const SEARCH_THRESHOLD = parseFloat(process.env.JEV_SEARCH_THRESHOLD || "0.5") || 0.5;

export async function decideSearchAction(context: string): Promise<SearchDecision> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    logger.warn("[RITU][JEV] LLM_API_KEY missing — falling back to direct search");
    return "search";
  }
  const model = process.env.JEV_MODEL || "typesafe/jev-1.13";
  try {
    const res = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        state: { query: context },
        questions: {
          search_now: {
            type: "noul",
            instructions:
              "Is this request specific enough to search marketplaces directly, without asking a clarifying question?",
            criteria: {
              true: "The request names a concrete product type and enough measurable requirements (brand, model, size, material, condition, budget, technical specs) to produce a useful search.",
              false:
                "The request is vague or ambiguous (missing product type, vague adjectives like good/nice/fast, or no measurable criteria), and a clarifying question would materially improve the search.",
            },
          },
        },
      }),
    });
    if (!res.ok) {
      logger.warn(
        `[RITU][JEV] decide failed: status ${res.status} — falling back to direct search`,
      );
      return "search";
    }
    const data = (await res.json()) as {
      answers?: { search_now?: { noul?: unknown } };
    };
    const noul = data.answers?.search_now?.noul;
    if (typeof noul !== "number") {
      logger.warn("[RITU][JEV] decide failed: missing noul — falling back to direct search");
      return "search";
    }
    const action: SearchDecision = noul >= SEARCH_THRESHOLD ? "search" : "clarify";
    logger.info(`[RITU][JEV] decide noul=${noul} action=${action} threshold=${SEARCH_THRESHOLD}`);
    return action;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`[RITU][JEV] decide failed: ${msg} — falling back to direct search`);
    return "search";
  }
}
