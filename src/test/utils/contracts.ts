import type { z } from "zod";

export function expectSchema<T>(obj: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new Error(
      `Contract assertion failed: expected schema match.\n` +
        `Errors: ${JSON.stringify(result.error.errors)}\n` +
        `Received: ${JSON.stringify(obj)}`,
    );
  }
  return result.data;
}
