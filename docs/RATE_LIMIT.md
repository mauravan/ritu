# Rate Limits

## Env vars

- `RICARDO_CONCURRENCY` / `RATE_LIMIT_CONCURRENCY` (default 1)
- `RICARDO_RPS` / `RATE_LIMIT_RPS` (default 1)
- `TUTTI_CONCURRENCY` / `RATE_LIMIT_CONCURRENCY` (default 1)
- `TUTTI_RPS` / `RATE_LIMIT_RPS` (default 1)

`parseEnvInt`: primary key, then fallback, then `def`; rejects `NaN` or `<1`, returns `def`.

## p-limit usage

`ricardoLimiter = pLimit(ricardoConcurrency)`; `tuttiLimiter = pLimit(tuttiConcurrency)`. Each adapter uses its limiter via `withRicardoLimit` / `withTuttiLimit`: `limiter(async () => { await throttle(service); return fn(); })`.

## Throttle mechanism

Token-bucket style: `throttle(service)` computes `interval = 1000 / rps`, waits `max(0, last + interval - now)`, updates `last = Date.now()`. Serialized by `p-limit(1)` gives exact 1 req/s spacing at default.

## Retry (`withRetry`)

Max 3 retries; initial delay 1000ms, exponential backoff (`delayMs *= 2`) when no explicit `Retry-After`. Detects rate-limited errors:

- `status === 429`
- `body` or `message` includes `1015` or `429`
- Headers `retry-after` / `Retry-After` / `retry-after-ms` parsed (`parseRetryAfter`: seconds → ms; `0` → 1000ms; HTTP date → diff vs now; else 1000ms).

Effective wait: `retryAfterMs` if present and >0; else `delayMs`; `0` mapped to `delayMs`.

## Defaults

1 concurrent, 1 req/s per service. Increasing risks 429/1015 from marketplace WAF.
