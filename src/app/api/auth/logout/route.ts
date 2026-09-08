import { NextResponse } from "next/server";
import { AuthLogoutRequestSchema } from "@/lib/schemas";
import { clearAuthContext } from "@/lib/auth/session";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AuthLogoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
  }

  await clearAuthContext(parsed.data.marketplace);
  return NextResponse.json({ ok: true });
}
