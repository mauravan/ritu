import { logger } from "../logger";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { ValidationError } from "../errors";
import { DerivedSpecSchema } from "../schemas";
import type { DerivedSpec } from "../types";
import { SYSTEM_PROMPT } from "./prompt";

function tryParseJsonFromText(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock?.[1]) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch {}
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

export async function deriveSpecs(input: string, clarifyingAnswer?: string): Promise<DerivedSpec> {
  const trimmedInput = input.trim();
  if (trimmedInput.length < 3) throw new ValidationError("Input too short (min 3 chars)");
  const trimmed = trimmedInput.slice(0, 500);
  const promptText = clarifyingAnswer
    ? `Original request: ${trimmed}\nClarifying context from user: ${clarifyingAnswer}`
    : trimmed;
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    throw new Error("LLM_API_KEY missing — cannot derive specs without LLM");
  }

  const openai = createOpenAI({ apiKey, baseURL });

  try {
    logger.info(
      `[RITU][LLM] deriveSpecs input="${trimmed.slice(0, 120)}" model=${model} baseURL=${baseURL}`,
    );
    const start = Date.now();
    const { object } = await generateObject({
      model: openai(model),
      schema: DerivedSpecSchema,
      system: SYSTEM_PROMPT,
      prompt: promptText,
      temperature: 0.2,
    });
    logger.info(
      `[RITU][LLM] spec ok ${Date.now() - start}ms category=${object.category} queries=${JSON.stringify(object.searchQueries)} req=${JSON.stringify(object.requirements)} excluded=${JSON.stringify(object.excludedTerms)}`,
    );
    return object;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[RITU][LLM] generateObject failed: ${msg} — trying generateText fallback`);
    if (err instanceof ValidationError) throw err;

    try {
      const { text } = await generateText({
        model: openai(model),
        system:
          SYSTEM_PROMPT +
          '\n\nReturn ONLY valid JSON matching this shape: {"category": string, "summary": string, "requirements": [{"key": string, "value": string, "importance": "required"|"preferred"}], "searchQueries": string[], "excludedTerms": string[]}. No markdown, no extra text.',
        prompt: promptText,
        temperature: 0.2,
      });
      logger.info(`[RITU][LLM] generateText raw: ${text.slice(0, 500)}`);
      const parsed = tryParseJsonFromText(text);
      if (parsed) {
        const validated = DerivedSpecSchema.safeParse(parsed);
        if (validated.success) {
          logger.info(`[RITU][LLM] generateText fallback ok category=${validated.data.category}`);
          return validated.data;
        } else {
          const flat = validated.error.flatten();
          throw new ValidationError("LLM response validation failed", {
            fields: flat.fieldErrors as Record<string, string[]>,
            raw: parsed,
          });
        }
      } else {
        logger.warn("[RITU][LLM] generateText fallback could not parse JSON");
      }
    } catch (innerErr) {
      if (innerErr instanceof ValidationError) throw innerErr;
      logger.warn(
        `[RITU][LLM] generateText fallback failed: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`,
      );
    }
  }
  throw new Error("All LLM attempts failed — cannot derive specs");
}

export { tryParseJsonFromText };
