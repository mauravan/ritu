import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { logger } from "../logger";

const ASK_TIMEOUT_MS = 15_000;
const ASK_MAX_OUTPUT_TOKENS = 200;

export async function askClarifyingQuestion(query: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    logger.warn(
      "[RITU][LLM] askClarifying: LLM_API_KEY missing — falling back to deriveSpecs behavior handled by caller",
    );
    throw new Error("LLM_API_KEY missing");
  }

  const openai = createOpenAI({ apiKey, baseURL });

  const prompt = `Given the user request: "${query.trim().slice(0, 300)}"
Ask ONE concise clarifying question to help derive precise product specs. Focus on use-case, price range, performance level, size/form-factor, or specific requirements. Keep it under 20 words.`;

  const { text } = await generateText({
    model: openai(model),
    system:
      "Ask one concise clarifying question. Respond ONLY with the question text, no JSON, no quotes.",
    prompt,
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    timeout: ASK_TIMEOUT_MS,
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "minimal" } },
  });
  const q = text.trim().replace(/^"+|"+$/g, "");
  if (!q) throw new Error(`Failed to parse clarifying question from LLM: ${text.slice(0, 200)}`);
  logger.info(`[RITU][LLM] askClarifying ok question="${q.slice(0, 140)}"`);
  return q;
}
