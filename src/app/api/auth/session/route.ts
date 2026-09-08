import { NextResponse } from "next/server";
import { AuthSessionRequestSchema } from "@/lib/schemas";
import { setAuthContext } from "@/lib/auth/session";
import { validateRicardoSession, validateTuttiSession } from "@/lib/auth/validate";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AuthSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
  }

  const { marketplace, cookieString } = parsed.data;

  // Validate via lightweight probe
  const isValid =
    marketplace === "ricardo"
      ? await validateRicardoSession(cookieString)
      : await validateTuttiSession(cookieString);

  if (!isValid) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  await setAuthContext({
    [marketplace]: {
      cookies: cookieString,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  } as unknown as Parameters<typeof setAuthContext>[0]);

  return NextResponse.json({ ok: true, marketplace });
}
