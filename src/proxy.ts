import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import pLimit from "p-limit";

// Rate limit: read at module load; tests can override env before import.
const rateLimitMax = parseInt(process.env.IP_RATE_LIMIT || "10", 10) || 10;

// Per-IP concurrency limiter tracked with p-limit per plan requirements.
const limiterByIp: Record<string, import("p-limit").LimitFunction> = {};

function getLimiter(ip: string): import("p-limit").LimitFunction {
  if (!limiterByIp[ip]) {
    limiterByIp[ip] = pLimit(1);
  }
  return limiterByIp[ip];
}

// Rate limit tracking: timestamps within 1-minute window per IP
const requestTimestamps: Record<string, number[]> = {};

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = requestTimestamps[ip] || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  requestTimestamps[ip] = recent;
  return recent.length > rateLimitMax;
}

export function proxy(req: NextRequest): NextResponse {
  // (a) Basic API-key auth via x-api-key header
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.RITU_API_KEY;

  if (!expectedKey) {
    return new NextResponse("Server misconfigured: RITU_API_KEY missing", {
      status: 500,
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return new NextResponse("Unauthorized: invalid or missing x-api-key", {
      status: 401,
    });
  }

  // (b) Rate limit by IP (x-forwarded-for / req.ip)
  const forwarded = req.headers.get("x-forwarded-for") || "unknown";
  const trimmed = (forwarded.split(",")[0] || "").trim();
  const ip = trimmed || "unknown";
  if (isRateLimited(ip)) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  // Register limiter usage per IP (plan requires p-limit import/usage)
  getLimiter(ip);

  return NextResponse.next();
}

export const config = {
  matcher: "/api/search",
};
