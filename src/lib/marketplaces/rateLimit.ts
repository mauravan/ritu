// Central rate-limit module for ricardo and tutti
import { logger } from "../logger";
// Env-configurable: 1 concurrent, 1 req/s default; increase at own risk (may trigger 429/1015)

import pLimit, { type LimitFunction } from "p-limit";

export type RateLimiter = LimitFunction;

function parseEnvInt(primary: string, fallback: string | undefined, def: number): number {
  const raw = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
  if (raw === undefined || raw === "") return def;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return def;
  return n;
}

const ricardoConcurrency = parseEnvInt("RICARDO_CONCURRENCY", "RATE_LIMIT_CONCURRENCY", 1);
const ricardoRps = parseEnvInt("RICARDO_RPS", "RATE_LIMIT_RPS", 1);
const tuttiConcurrency = parseEnvInt("TUTTI_CONCURRENCY", "RATE_LIMIT_CONCURRENCY", 1);
const tuttiRps = parseEnvInt("TUTTI_RPS", "RATE_LIMIT_RPS", 1);

export const ricardoLimiter = pLimit(ricardoConcurrency);
export const tuttiLimiter = pLimit(tuttiConcurrency);

export const rateLimitConfig = {
  ricardoConcurrency,
  ricardoRps,
  tuttiConcurrency,
  tuttiRps,
} as const;

// Token-bucket style throttle: enforce interval between dispatches using lastCall timestamp
let lastRicardoCall = 0;
let lastTuttiCall = 0;

async function throttle(service: "ricardo" | "tutti"): Promise<void> {
  const rps = service === "ricardo" ? ricardoRps : tuttiRps;
  logger.info(
    `[RITU][RATE] throttle service=${service} rps=${rps} interval=${Math.round(1000 / rps)}ms`,
  );
  const interval = 1000 / rps;
  const last = service === "ricardo" ? lastRicardoCall : lastTuttiCall;
  const now = Date.now();
  const wait = last + interval - now;
  if (wait > 0) {
    logger.info(`[RITU][RATE] throttle wait=${Math.round(wait)}ms service=${service}`);
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
  if (service === "ricardo") lastRicardoCall = Date.now();
  else lastTuttiCall = Date.now();
  logger.info(
    `[RITU][RATE] throttle updated last=${service === "ricardo" ? lastRicardoCall : lastTuttiCall} service=${service}`,
  );
}

/**
 * Execute fn under concurrency limiter + RPS throttle.
 * Serialized via p-limit(1) already gives spacing; with concurrency 1 this is exactly 1 req/s.
 */
export async function throttled<T>(
  limiter: RateLimiter,
  rps: number,
  fn: () => Promise<T>,
  service?: "ricardo" | "tutti",
): Promise<T> {
  // If service is known, use shared throttle state; otherwise use local interval
  if (service) {
    logger.info(
      `[RITU][RATE] limiter enter service=${service} concurrency=${service === "ricardo" ? ricardoConcurrency : tuttiConcurrency}`,
    );
    return limiter(async () => {
      await throttle(service);
      const start = Date.now();
      try {
        const result = await fn();
        logger.info(
          `[RITU][RATE] dispatch complete service=${service} timestamp=${start} duration=${Date.now() - start}`,
        );
        return result;
      } catch (e) {
        logger.info(
          `[RITU][RATE] dispatch error service=${service} timestamp=${start} error=${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    });
  }
  let last = 0;
  const interval = 1000 / rps;
  return limiter(async () => {
    const start = Date.now();
    logger.info(`[RITU][RATE] dispatch start no-service timestamp=${start}`);
    const now = Date.now();
    const wait = Math.max(0, last + interval - now);
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
    const result = await fn();
    logger.info(
      `[RITU][RATE] dispatch complete no-service timestamp=${start} duration=${Date.now() - start}`,
    );
    last = Date.now();
    return result;
  });
}

export async function withRicardoLimit<T>(fn: () => Promise<T>): Promise<T> {
  return ricardoLimiter(async () => {
    await throttle("ricardo");
    return fn();
  });
}

export async function withTuttiLimit<T>(fn: () => Promise<T>): Promise<T> {
  return tuttiLimiter(async () => {
    await throttle("tutti");
    return fn();
  });
}

function isRateLimitedError(err: unknown): { limited: boolean; retryAfterMs: number | null } {
  // Check TuttiHttpError with status 429
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const status = e.status as number | undefined;
    const body =
      typeof e.body === "string"
        ? e.body
        : typeof e.message === "string"
          ? (e.message as string)
          : "";
    const message = typeof e.message === "string" ? (e.message as string) : "";
    // TuttiHttpError: status 429
    if (status === 429) {
      // Try to parse Retry-After from body or headers if present
      const retryAfter = extractRetryAfter(err);
      return { limited: true, retryAfterMs: retryAfter };
    }
    // Cloudflare 1015 error code in body
    if (body.includes("1015") || body.includes("error code: 1015") || message.includes("1015")) {
      return { limited: true, retryAfterMs: extractRetryAfter(err) };
    }
    // Generic 429 via message/statusText
    if (message.includes("429") || String(status) === "429") {
      return { limited: true, retryAfterMs: extractRetryAfter(err) };
    }
    // Check headers Retry-After if present on error object
    if (e.headers && typeof e.headers === "object") {
      const h = e.headers as Record<string, unknown>;
      const ra = h["retry-after"] ?? h["Retry-After"] ?? h.RetryAfter;
      if (typeof ra === "string") {
        const ms = parseRetryAfter(ra);
        if (ms !== null) return { limited: true, retryAfterMs: ms };
      }
    }
  }
  if (err instanceof Error) {
    if (err.message.includes("429") || err.message.includes("1015")) {
      return { limited: true, retryAfterMs: null };
    }
  }
  return { limited: false, retryAfterMs: null };
}

function extractRetryAfter(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  // TuttiHttpError may have body containing Retry-After; try to parse headers if attached
  const headers = (e.headers ?? (e as Record<string, unknown>).responseHeaders) as unknown;
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, unknown>;
    const ra =
      h["retry-after"] ??
      h["Retry-After"] ??
      h["retry-after-ms"] ??
      h["Retry-After"] ??
      h.retryAfter;
    if (typeof ra === "string" || typeof ra === "number") {
      const parsed = parseRetryAfter(String(ra));
      if (parsed !== null) return parsed;
    }
    // If headers is Headers instance
    if (typeof (headers as { get?: unknown }).get === "function") {
      try {
        const v =
          (headers as { get: (k: string) => string | null }).get("retry-after") ??
          (headers as { get: (k: string) => string | null }).get("Retry-After");
        if (v) {
          const p = parseRetryAfter(v);
          if (p !== null) return p;
        }
      } catch {}
    }
  }
  // Check body for retry-after numeric
  const body = (e.body as string) ?? "";
  const m = body.match(/retry-after[^0-9]*([0-9]+)/i);
  if (m?.[1]) {
    const sec = parseInt(m[1], 10);
    if (!Number.isNaN(sec)) return sec * 1000;
  }
  return null;
}

function parseRetryAfter(value: string): number | null {
  const num = parseInt(value, 10);
  if (!Number.isNaN(num)) {
    // Retry-After is seconds per HTTP spec; if value looks like ms (>1000 and > 100s) ambiguous, assume seconds unless > 1000?
    // Use seconds->ms
    // Cloudflare may send 0 -> default 1000ms per plan
    if (num === 0) return 1000;
    return num * 1000;
  }
  // Try HTTP date
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 1000;
  }
  return null;
}

export async function withRetry<T>(fn: () => Promise<T>, service: "ricardo" | "tutti"): Promise<T> {
  const maxRetries = 3;
  let attempt = 0;
  let delayMs = 1000;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const { limited, retryAfterMs } = isRateLimitedError(err);
      if (!limited) throw err;
      if (attempt >= maxRetries) throw err;
      const waitMs = retryAfterMs !== null && retryAfterMs > 0 ? retryAfterMs : delayMs;
      // Cloudflare 1015 with retry-after 0 -> use default delayMs, not 0
      const effectiveWait = waitMs === 0 ? delayMs : waitMs;
      logger.warn(
        `[RITU][RATE] ${service} 429 retry ${attempt + 1}/${maxRetries} after ${effectiveWait}ms`,
      );
      logger.info(
        `[RITU][RATE] retry attempt=${attempt + 1}/${maxRetries} service=${service} limited=${limited} retryAfterMs=${retryAfterMs} waitMs=${waitMs} effectiveWait=${effectiveWait}`,
      );
      await new Promise<void>((r) => setTimeout(r, effectiveWait));
      attempt++;
      // exponential backoff 1s ->2s ->4s if no explicit Retry-After
      if (retryAfterMs === null) delayMs *= 2;
      else delayMs = 1000 * 2 ** attempt;
    }
  }
  throw new Error("withRetry exhausted retries unexpectedly");
}

// Test exports
export { extractRetryAfter, isRateLimitedError, parseEnvInt, parseRetryAfter, throttle };
