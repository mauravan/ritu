import { logger } from "./logger";
import { HttpsProxyAgent } from "https-proxy-agent";
import https from "node:https";

function parseProxies(): Array<{ host: string; port: string; password: string }> {
  const raw = process.env.PROXY_LIST ?? "";
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(":");
      const host = parts[0] ?? "";
      const port = parts[1] ?? "";
      const password = parts.slice(2).join(":");
      if (!host || !port) return null;
      return { host, port, password };
    })
    .filter((p): p is { host: string; port: string; password: string } => p !== null);
}

let current = 0;

export function getProxyFetch(): typeof fetch {
  const proxies = parseProxies();
  logger.info(`[RITU][PROXY] loaded ${proxies.length} proxies`);
  if (proxies.length === 0) {
    return global.fetch;
  }
  const proxy = proxies[current % proxies.length];
  if (!proxy) return global.fetch;
  current += 1;
  const proxyUrl = `http://${encodeURIComponent(proxy.password)}@${proxy.host}:${proxy.port}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  return async function proxyFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return new Promise((resolve, reject) => {
      const urlObj = new URL(urlStr);
      const req = https.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === "https:" ? "443" : "80"),
          path: urlObj.pathname + urlObj.search,
          method: init?.method ?? "GET",
          headers: init?.headers
            ? Object.fromEntries(new Headers(init.headers as HeadersInit))
            : {},
          agent,
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 200,
              statusText: res.statusMessage ?? "",
              headers: new Headers(
                Object.fromEntries(
                  Object.entries(res.headers).map(([k, v]) => [
                    k,
                    Array.isArray(v) ? v.join(", ") : (v ?? ""),
                  ]),
                ) as Record<string, string>,
              ),
              ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
              text: async () => data,
              json: async () => JSON.parse(data),
            } as Response);
          });
        },
      );
      req.on("error", reject);
      if (init?.body) {
        req.write(typeof init.body === "string" ? init.body : JSON.stringify(init.body));
      }
      req.end();
    });
  } as typeof fetch;
}
