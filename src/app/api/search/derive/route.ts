import { NextResponse } from "next/server";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import { parseSearchRequest } from "@/lib/parseSearchRequest";

export async function POST(req: Request): Promise<Response> {
  const parsed = await parseSearchRequest(req);
  if (!parsed.ok) return parsed.errorResponse;
  const { query, clarifyingAnswer } = parsed.data;
  try {
    const derivedSpec = await deriveSpecs(query, clarifyingAnswer);
    return NextResponse.json({ derivedSpec });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation_error", details: err.message },
        { status: 400 },
      );
    }
    if (err instanceof SpecDerivationError) {
      return NextResponse.json(
        { error: "spec_derivation_failed", details: err.message },
        { status: 502 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "internal_error", details: msg }, { status: 500 });
  }
}
