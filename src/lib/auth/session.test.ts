import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const v = store.get(name);
      return v ? { value: v } : undefined;
    },
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  })),
}));

import { getAuthContext, setAuthContext, clearAuthContext } from "./session";

describe("auth session", () => {
  beforeEach(() => {
    store.clear();
    process.env.AUTH_SECRET = "test-secret-32-chars-long-enough!!";
  });

  it("encrypt/decrypt roundtrip", async () => {
    await setAuthContext({
      ricardo: { cookies: "ricardo_session=abc", expiresAt: new Date(Date.now() + 100000).toISOString() },
    });
    const ctx = await getAuthContext();
    expect(ctx?.ricardo?.cookies).toBe("ricardo_session=abc");
  });

  it("tamper detection returns null", async () => {
    await setAuthContext({
      ricardo: { cookies: "x", expiresAt: new Date(Date.now() + 100000).toISOString() },
    });
    const token = store.get("ritu_auth")!;
    store.set("ritu_auth", token.slice(0, -2) + "ab");
    const ctx = await getAuthContext();
    expect(ctx).toBeNull();
  });

  it("expiry handling returns null for expired", async () => {
    await setAuthContext({
      tutti: { cookies: "y", expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
    const ctx = await getAuthContext();
    expect(ctx === null || ctx.tutti === null).toBeTruthy();
  });

  it("setAuthContext merge behavior", async () => {
    await setAuthContext({
      ricardo: { cookies: "r1", expiresAt: new Date(Date.now() + 100000).toISOString() },
    });
    await setAuthContext({
      tutti: { cookies: "t1", expiresAt: new Date(Date.now() + 100000).toISOString() },
    });
    const ctx = await getAuthContext();
    expect(ctx?.ricardo?.cookies).toBe("r1");
    expect(ctx?.tutti?.cookies).toBe("t1");
  });

  it("clearAuthContext clears one slot", async () => {
    await setAuthContext({
      ricardo: { cookies: "r1", expiresAt: new Date(Date.now() + 100000).toISOString() },
      tutti: { cookies: "t1", expiresAt: new Date(Date.now() + 100000).toISOString() },
    });
    await clearAuthContext("ricardo");
    const ctx = await getAuthContext();
    expect(ctx?.ricardo).toBeNull();
    expect(ctx?.tutti?.cookies).toBe("t1");
  });
});
