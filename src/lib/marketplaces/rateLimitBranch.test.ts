import pLimit from "p-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractRetryAfter,
  isRateLimitedError,
  parseRetryAfter,
  throttled,
  withRetry,
} from "./rateLimit";

describe("rateLimit branch extensions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("throttled with service logs limiter entry", async () => {
    const result = await throttled(pLimit(1), 100, async () => "svc", "ricardo");
    expect(result).toBe("svc");
  });

  it("detects rate limit via headers object variants", () => {
    const err = { status: 429, headers: { "retry-after": "2" } };
    expect(extractRetryAfter(err)).toBe(2000);
    expect(isRateLimitedError({ headers: { "retry-after": "3" } }).limited).toBe(true);
  });

  it("extractRetryAfter handles throwing Headers.get", () => {
    const err = {
      headers: {
        get: () => {
          throw new Error("nope");
        },
      },
    };
    expect(extractRetryAfter(err)).toBeNull();
  });

  it("parseRetryAfter clamps past dates to 1000ms", () => {
    const past = new Date(Date.now() - 60000).toUTCString();
    expect(parseRetryAfter(past)).toBe(1000);
  });

  it("withRetry rethrows after exhausting retries", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      throw new Error("429 limited");
    }, "tutti");
    const assertion = expect(promise).rejects.toThrow("429 limited");
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(attempts).toBe(4);
  });

  it("withRetry uses default delay when retry-after is zero", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const promise = withRetry(async () => {
      attempts++;
      if (attempts === 1) throw { status: 429, headers: { "retry-after": "0" } };
      return "ok";
    }, "ricardo");
    const assertion = expect(promise).resolves.toBe("ok");
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
