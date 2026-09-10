# Plan: deriveSpecs structured validation

Context: Fix fragile regex fallback in deriveSpecs (tryParseJsonFromText) and raw Error throws. Replace with z .strict() validation on parsed result and return structured ValidationError with field-level diagnostics.

Approach (ordered, no design choices left):
1. src/lib/schemas.ts: Change DerivedSpecSchema to .strict().
2. src/lib/errors.ts: Extend ValidationError constructor to accept optional fields?: Record<string, string[]> and raw?: unknown; assign them as this.fields and this.raw.
3. src/lib/llm/deriveSpecs.ts:
   - Keep tryParseJsonFromText (manual extraction still needed for markdown/code-block input), but treat its result as untrusted.
   - After safeParse(parsed), when !validated.success, instead of only console.warn, throw new ValidationError("LLM response validation failed", { fields: validated.error.flatten().fieldErrors as Record<string, string[]>, raw: parsed }).
   - If both attempts fail, keep final throw new Error("All LLM attempts failed...") as fallback (only when no structured validation error occurred); if attempt 2 produced a validation error, that structured error should propagate rather than being masked.

Critical files:
- src/lib/llm/deriveSpecs.ts — parse/validate path (lines 82-99).
- src/lib/schemas.ts — .strict() addition.
- src/lib/errors.ts — ValidationError extension.

Verification:
- npm test -- src/lib/llm/deriveSpecs.test.ts passes.
- Confirm thrown error on invalid LLM JSON is instanceof ValidationError with .fields set to zod field errors.
