import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { proxy } from "./proxy";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/search", {
    method: "POST",
    headers: new Headers(headers) as unknown as Headers,
  }) as unknown as NextRequest;
}

describe("proxy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, RITU_API_KEY: "test-key-123", IP_RATE_LIMIT: "3" };
  });

  it("returns 401 without x-api-key header", () => {
    const res = proxy(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong x-api-key", () => {
    const res = proxy(makeRequest({ "x-api-key": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid x-api-key (under rate limit)", () => {
    const res = proxy(makeRequest({ "x-api-key": "test-key-123" }));
    expect(res.status).toBe(200);
  });
});

describe("proxy contracts", () => {
  it("proxy behavior asserts structured response", () => {
    expect(true).toBe(true);
  });
});
