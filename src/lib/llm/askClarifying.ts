import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { logger } from "../logger";
import type { Locale } from "../types";
import { buildClarifyingUserPrompt, getClarifyingSystemPrompt } from "./prompt";

const ASK_TIMEOUT_MS = 15_000;
const ASK_MAX_OUTPUT_TOKENS = 200;

export async function askClarifyingQuestion(query: string, locale: Locale = "de"): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_MODEL || "google/gemma-4-31b-it:free";

  if (!apiKey) {
    logger.warn(
      "[RITU][LLM] askClarifying: LLM_API_KEY missing — falling back to deriveSpecs behavior handled by caller",
    );
    throw new Error("LLM_API_KEY missing");
  }

  const openai = createOpenAI({ apiKey, baseURL });

  const prompt = buildClarifyingUserPrompt(query, locale);

  const { text } = await generateText({
    model: openai(model),
    system: getClarifyingSystemPrompt(locale),
    prompt,
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    reasoning: "low",
    timeout: ASK_TIMEOUT_MS,
  });
  const q = text.trim().replace(/^"+|"+$/g, "");
  if (!q) throw new Error(`Failed to parse clarifying question from LLM: ${text.slice(0, 200)}`);
  logger.info(`[RITU][LLM] askClarifying ok question="${q.slice(0, 140)}"`);
  return q;
}
