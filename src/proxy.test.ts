import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

describe("proxy", () => {
  const createRequest = (headers: Record<string, string> = {}): NextRequest => {
    const req = new NextRequest("https://example.com/api/search", { headers });
    return req;
  };

  it("returns 500 when RITU_API_KEY is not set", async () => {
    vi.stubEnv("RITU_API_KEY", undefined);
    const { proxy } = await import("./proxy");
    const req = createRequest({ "x-api-key": "test-key" });
    const res = proxy(req);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Server misconfigured: RITU_API_KEY missing");
  });

  it("returns 401 when x-api-key header is missing", async () => {
    vi.stubEnv("RITU_API_KEY", "valid-key");
    const { proxy } = await import("./proxy");
    const req = createRequest({});
    const res = proxy(req);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized: invalid or missing x-api-key");
  });

  it("returns 401 when x-api-key is invalid", async () => {
    vi.stubEnv("RITU_API_KEY", "valid-key");
    const { proxy } = await import("./proxy");
    const req = createRequest({ "x-api-key": "wrong-key" });
    const res = proxy(req);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized: invalid or missing x-api-key");
  });

  it("returns 200 and next() when valid key provided", async () => {
    vi.stubEnv("RITU_API_KEY", "valid-key");
    const { proxy } = await import("./proxy");
    const req = createRequest({ "x-api-key": "valid-key" });
    const res = proxy(req);
    expect(res.status).toBe(200);
  });

  it("uses x-forwarded-for for IP", async () => {
    vi.stubEnv("RITU_API_KEY", "valid-key");
    vi.stubEnv("IP_RATE_LIMIT", "10");
    const { proxy } = await import("./proxy");
    const req = createRequest({
      "x-api-key": "valid-key",
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
  });

  it("falls back to unknown IP when no x-forwarded-for", async () => {
    vi.stubEnv("RITU_API_KEY", "valid-key");
    vi.stubEnv("IP_RATE_LIMIT", "10");
    const { proxy } = await import("./proxy");
    const req = createRequest({ "x-api-key": "valid-key" });
    const res = proxy(req);
    expect(res.status).toBe(200);
  });
});
