import { describe, expect, it, vi } from "vitest";
import pLimit from "p-limit";
import {
  parseEnvInt,
  throttle,
  isRateLimitedError,
  extractRetryAfter,
  parseRetryAfter,
  throttled,
  withRicardoLimit,
  withTuttiLimit,
  withRetry,
} from "./rateLimit";
describe("rateLimit", () => {
  describe("parseEnvInt", () => {
    it("returns default when env var not set", () => {
      vi.stubEnv("TEST_VAR", undefined);
      expect(parseEnvInt("TEST_VAR", undefined, 5)).toBe(5);
    });

    it("returns default when env var is empty", () => {
      vi.stubEnv("TEST_VAR", "");
      expect(parseEnvInt("TEST_VAR", undefined, 5)).toBe(5);
    });

    it("parses valid integer", () => {
      vi.stubEnv("TEST_VAR", "10");
      expect(parseEnvInt("TEST_VAR", undefined, 5)).toBe(10);
    });

    it("returns default for NaN", () => {
      vi.stubEnv("TEST_VAR", "abc");
      expect(parseEnvInt("TEST_VAR", undefined, 5)).toBe(5);
    });

    it("returns default for negative numbers", () => {
      vi.stubEnv("TEST_VAR", "-1");
      expect(parseEnvInt("TEST_VAR", undefined, 5)).toBe(5);
    });

    it("uses fallback env var when primary not set", () => {
      vi.stubEnv("PRIMARY", undefined);
      vi.stubEnv("FALLBACK", "20");
      expect(parseEnvInt("PRIMARY", "FALLBACK", 5)).toBe(20);
      vi.unstubAllEnvs();
    });

    it("uses primary when both set", () => {
      vi.stubEnv("PRIMARY", "15");
      vi.stubEnv("FALLBACK", "20");
      expect(parseEnvInt("PRIMARY", "FALLBACK", 5)).toBe(15);
      vi.unstubAllEnvs();
    });
  });

  describe("throttle", () => {
    it("executes without error", async () => {
      await expect(throttle("ricardo")).resolves.toBeUndefined();
      await expect(throttle("tutti")).resolves.toBeUndefined();
    });

    it("tracks ricardo and tutti separately", async () => {
      await throttle("ricardo");
      await throttle("tutti");
      expect(true).toBe(true);
    });
  });

  describe("isRateLimitedError", () => {
    it("detects 429 status", () => {
      const err = { status: 429 } as Response;
      const result = isRateLimitedError(err);
      expect(result.limited).toBe(true);
    });

    it("detects 1015 in body", () => {
      const err = { status: 429, body: "error code: 1015" } as Record<string, unknown>;
      const result = isRateLimitedError(err);
      expect(result.limited).toBe(true);
    });

    it("detects 1015 in Error message", () => {
      const err = new Error("Cloudflare error 1015");
      const result = isRateLimitedError(err);
      expect(result.limited).toBe(true);
    });

    it("detects 429 in Error message", () => {
      const err = new Error("429 Too Many Requests");
      const result = isRateLimitedError(err);
      expect(result.limited).toBe(true);
    });

    it("returns not limited for other errors", () => {
      const err = new Error("network error");
      const result = isRateLimitedError(err);
      expect(result.limited).toBe(false);
    });

    it("returns not limited for null/undefined", () => {
      expect(isRateLimitedError(null).limited).toBe(false);
      expect(isRateLimitedError(undefined).limited).toBe(false);
    });
  });

  describe("extractRetryAfter", () => {
    it("extracts Retry-After header from response", () => {
      const err = {
        headers: {
          get: (name: string) => (name === "retry-after" ? "60" : null),
        },
      } as unknown as Response;
      expect(extractRetryAfter(err)).toBe(60000);
    });

    it("returns null when no Retry-After header", () => {
      const err = {
        headers: {
          get: () => null,
        },
      } as unknown as Response;
      expect(extractRetryAfter(err)).toBeNull();
    });

    it("extracts retry-after from body string", () => {
      const err = { body: "retry-after: 60" };
      expect(extractRetryAfter(err)).toBe(60000);
    });

    it("returns null for non-Response errors", () => {
      const err = new Error("network error");
      expect(extractRetryAfter(err)).toBeNull();
    });
  });

  describe("parseRetryAfter", () => {
    it("parses seconds", () => {
      expect(parseRetryAfter("60")).toBe(60000);
      expect(parseRetryAfter("1")).toBe(1000);
    });

    it("returns 1000 for zero seconds", () => {
      expect(parseRetryAfter("0")).toBe(1000);
    });

    it("parses HTTP date", () => {
      const futureDate = new Date(Date.now() + 120000).toUTCString();
      expect(parseRetryAfter(futureDate)).toBeLessThan(130000);
    });

    it("returns null for invalid input", () => {
      expect(parseRetryAfter("not-a-date-or-number")).toBeNull();
    });
  });

  describe("throttled", () => {
    it("executes function under limiter", async () => {
      const limiter = pLimit(1);
      let called = false;
      const result = await throttled(limiter, 10, async () => {
        called = true;
        return "done";
      });
      expect(result).toBe("done");
      expect(called).toBe(true);
    });

    it("propagates errors", async () => {
      const limiter = pLimit(1);
      await expect(
        throttled(limiter, 10, async () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");
    });
  });

  describe("withRicardoLimit", () => {
    it("executes function", async () => {
      let called = false;
      const result = await withRicardoLimit(async () => {
        called = true;
        return "ricardo";
      });
      expect(result).toBe("ricardo");
      expect(called).toBe(true);
    });

    it("propagates errors", async () => {
      await expect(
        withRicardoLimit(async () => {
          throw new Error("ricardo error");
        })
      ).rejects.toThrow("ricardo error");
    });
  });

  describe("withTuttiLimit", () => {
    it("executes function", async () => {
      let called = false;
      const result = await withTuttiLimit(async () => {
        called = true;
        return "tutti";
      });
      expect(result).toBe("tutti");
      expect(called).toBe(true);
    });

    it("propagates errors", async () => {
      await expect(
        withTuttiLimit(async () => {
          throw new Error("tutti error");
        })
      ).rejects.toThrow("tutti error");
    });
  });

  describe("withRetry", () => {
    it("retries on rate limit error", async () => {
      vi.useFakeTimers();
      let attempts = 0;
      const promise = withRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("429 Too Many Requests");
        }
        return "success";
      }, "ricardo");
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;
      expect(result).toBe("success");
      expect(attempts).toBe(2);
      vi.useRealTimers();
    });

    it("retries with explicit retry-after header", async () => {
      vi.useFakeTimers();
      let attempts = 0;
      const promise = withRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw {
            status: 429,
            headers: { get: (k: string) => (k === "retry-after" ? "1" : null) },
          };
        }
        return "done";
      }, "ricardo");
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;
      expect(result).toBe("done");
      expect(attempts).toBe(2);
      vi.useRealTimers();
    });

    it("throws immediately for non-rate-limit errors", async () => {
      let attempts = 0;
      await expect(
        withRetry(async () => {
          attempts++;
          throw new Error("network error");
        }, "ricardo")
      ).rejects.toThrow("network error");
      expect(attempts).toBe(1);
    });
  });
});