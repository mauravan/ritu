import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { ValidationError } from "../errors";
import { logger } from "../logger";
import { DerivedSpecSchema } from "../schemas";
import type { DerivedSpec } from "../types";
import { SYSTEM_PROMPT } from "./prompt";

const DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b";
const DERIVE_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 1500;
const JSON_OUTPUT_INSTRUCTION =
  '\n\nOutput exactly one JSON object and nothing else — no reasoning, no explanations, no recommendations, no markdown, no code fences. The object MUST have exactly these keys: "category" (string), "summary" (string), "requirements" (array of {"key": string, "value": string, "importance": "required"|"preferred"}), "searchQueries" (string[]), "excludedTerms" (string[]). Example: {"category": "mini pc", "summary": "Small home server", "requirements": [{"key": "ram", "value": "16GB", "importance": "preferred"}], "searchQueries": ["mini pc 16GB"], "excludedTerms": ["laptop"]}.';

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
  const fallbackModel = process.env.LLM_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  if (!apiKey) {
    throw new Error("LLM_API_KEY missing — cannot derive specs without LLM");
  }

  const openai = createOpenAI({ apiKey, baseURL });
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];

  let lastError: unknown;
  for (const m of models) {
    const start = Date.now();
    try {
      logger.info(
        `[RITU][LLM] deriveSpecs input="${trimmed.slice(0, 120)}" model=${m} baseURL=${baseURL}`,
      );
      const { text } = await generateText({
        model: openai(m),
        system: SYSTEM_PROMPT + JSON_OUTPUT_INSTRUCTION,
        prompt: promptText,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        timeout: DERIVE_TIMEOUT_MS,
        output: Output.object({ schema: DerivedSpecSchema }),
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "minimal" } },
      });
      logger.info(`[RITU][LLM] raw text ${Date.now() - start}ms: ${text.slice(0, 500)}`);
      const parsed = tryParseJsonFromText(text);
      if (!parsed) throw new Error("LLM response was not parseable JSON");
      const validated = DerivedSpecSchema.safeParse(parsed);
      if (!validated.success) {
        throw new ValidationError("LLM response validation failed", {
          fields: validated.error.flatten().fieldErrors as Record<string, string[]>,
          raw: parsed,
        });
      }
      logger.info(
        `[RITU][LLM] spec ok ${Date.now() - start}ms category=${validated.data.category} queries=${JSON.stringify(validated.data.searchQueries)} req=${JSON.stringify(validated.data.requirements)} excluded=${JSON.stringify(validated.data.excludedTerms)}`,
      );
      return validated.data;
    } catch (err) {
      lastError = err;
      logger.warn(
        `[RITU][LLM] derive attempt failed model=${m}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (lastError instanceof ValidationError) throw lastError;
  throw new Error("All LLM attempts failed — cannot derive specs");
}

export { tryParseJsonFromText };
