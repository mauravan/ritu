import { NextResponse } from "next/server";
import { SearchRequestSchema } from "./schemas";
import type { DerivedSpec, Locale, Platform } from "./types";

export type ParsedSearchRequest = {
  query: string;
  platform: Platform;
  askQuestion: boolean;
  locale: Locale;
  clarifyingAnswer?: string;
  clarifyingQuestion?: string;
  originalQuery?: string;
  derivedSpec?: DerivedSpec;
  zipCode?: string;
  radius?: number;
};

export type ParseSearchRequestResult =
  | { ok: true; data: ParsedSearchRequest }
  | { ok: false; errorResponse: Response };

export async function parseSearchRequest(req: Request): Promise<ParseSearchRequestResult> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      errorResponse: NextResponse.json({ error: "invalid_json" }, { status: 400 }),
    };
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  const query = parsed.data.query;
  return {
    ok: true,
    data: {
      query,
      platform: parsed.data.platform ?? "both",
      askQuestion: parsed.data.askQuestion ?? false,
      locale: parsed.data.locale,
      clarifyingAnswer: parsed.data.clarifyingAnswer,
      clarifyingQuestion: parsed.data.clarifyingQuestion,
      originalQuery: parsed.data.originalQuery,
      derivedSpec: parsed.data.derivedSpec,
      zipCode: parsed.data.zipCode && parsed.data.radius ? parsed.data.zipCode : undefined,
      radius: parsed.data.zipCode && parsed.data.radius ? parsed.data.radius : undefined,
    },
  };
}
