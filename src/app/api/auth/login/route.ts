import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const marketplace =
    body && typeof body === "object" && "marketplace" in body
      ? (body as { marketplace: string }).marketplace
      : "unknown";

  return NextResponse.json(
    {
      error: "browser_login_not_implemented",
      marketplace,
      fallback: "use /api/auth/session with pasted cookie",
      instructions:
        "Log in to the marketplace in your browser, copy document.cookie or the session cookie value, and POST it to /api/auth/session with { marketplace, cookieString }",
    },
    { status: 501 },
  );
}
