import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { logger } from "../logger";

const ClarifyingQuestionSchema = z.object({
  question: z.string().describe("One concise clarifying question"),
});

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

  try {
    const { object } = await generateObject({
      model: openai(model),
      schema: ClarifyingQuestionSchema,
      system: "You ask a single concise clarifying question to refine hardware/product specs.",
      prompt,
      temperature: 0.5,
    });
    logger.info(`[RITU][LLM] askClarifying ok question="${object.question.slice(0, 140)}"`);
    return object.question;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[RITU][LLM] askClarifying generateObject failed: ${msg} — trying generateText`);
    const { text } = await generateText({
      model: openai(model),
      system:
        "Ask one concise clarifying question. Respond ONLY with the question text, no JSON, no quotes.",
      prompt,
      temperature: 0.5,
    });
    const q = text.trim().replace(/^"+|"+$/g, "");
    if (!q) throw new Error(`Failed to parse clarifying question from LLM: ${text.slice(0, 200)}`);
    logger.info(`[RITU][LLM] askClarifying text fallback question="${q.slice(0, 140)}"`);
    return q;
  }
}
