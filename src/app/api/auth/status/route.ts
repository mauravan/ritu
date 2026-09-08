import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import type { AuthStatus } from "@/lib/types";

export async function GET() {
  const ctx = await getAuthContext();
  const status: AuthStatus = {
    ricardo: !!ctx?.ricardo,
    tutti: !!ctx?.tutti,
  };
  return NextResponse.json(status);
}
