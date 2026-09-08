import { cookies } from "next/headers";
import * as jose from "jose";
import { COOKIE_NAME, COOKIE_OPTIONS, getAuthSecret } from "./config";
import { AuthContextSchema } from "../schemas";
import type { AuthContext } from "../types";

export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const secret = getAuthSecret();
    const { payload } = await jose.jwtDecrypt(token, secret);

    // payload is stored as { data: AuthContext, exp... }
    const data = (payload as unknown as { data: unknown }).data;
    const parsed = AuthContextSchema.safeParse(data);
    if (!parsed.success) return null;

    const ctx = parsed.data;
    if (!ctx) return null;

    // Check expiry for each slot
    const now = Date.now();
    let mutated = false;
    if (ctx.ricardo && new Date(ctx.ricardo.expiresAt).getTime() < now) {
      ctx.ricardo = null;
      mutated = true;
    }
    if (ctx.tutti && new Date(ctx.tutti.expiresAt).getTime() < now) {
      ctx.tutti = null;
      mutated = true;
    }
    if (mutated && ctx.ricardo === null && ctx.tutti === null) return null;
    return ctx;
  } catch {
    return null;
  }
}

export async function setAuthContext(patch: Partial<NonNullable<AuthContext>>): Promise<void> {
  const existing = (await getAuthContext()) || { ricardo: null, tutti: null };
  const merged: NonNullable<AuthContext> = {
    ricardo: patch.ricardo !== undefined ? patch.ricardo : existing.ricardo,
    tutti: patch.tutti !== undefined ? patch.tutti : existing.tutti,
  };

  const secret = getAuthSecret();
  const token = await new jose.EncryptJWT({ data: merged } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function clearAuthContext(marketplace: "ricardo" | "tutti"): Promise<void> {
  const existing = await getAuthContext();
  if (!existing) return;

  const updated: NonNullable<AuthContext> = {
    ricardo: existing.ricardo,
    tutti: existing.tutti,
  };
  updated[marketplace] = null;

  if (updated.ricardo === null && updated.tutti === null) {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return;
  }

  const secret = getAuthSecret();
  const token = await new jose.EncryptJWT({ data: updated } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}
