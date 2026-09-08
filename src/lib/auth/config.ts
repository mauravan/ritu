import { createHash } from "crypto";

export const COOKIE_NAME = "ritu_auth";
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

let ephemeralSecret: Uint8Array | null = null;

function toKey(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  return createHash("sha256").update(bytes).digest();
}

export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.trim().length >= 16) {
    return toKey(new TextEncoder().encode(secret));
  }
  if (!ephemeralSecret) {
    // generate ephemeral key for dev; sessions won't survive restart
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    ephemeralSecret = bytes;
    console.warn("[RITU] WARN AUTH_SECRET not set — sessions will not survive restart");
  }
  return ephemeralSecret;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};
