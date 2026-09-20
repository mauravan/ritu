import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { logger } from "./logger";

function parseProxies(): Array<{
  host: string;
  port: string;
  username: string;
  password: string;
}> {
  const raw = process.env.PROXY_LIST ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const parts = entry.split(":");
      const host = parts[0] ?? "";
      const port = parts[1] ?? "";
      const username = parts[2] ?? "";
      const password = parts.slice(3).join(":");
      if (!host || !port) return null;
      return { host, port, username, password };
    })
    .filter(
      (
        p,
      ): p is {
        host: string;
        port: string;
        username: string;
        password: string;
      } => p !== null,
    );
}

const currentCounter = { value: 0 };

export function getProxyFetch(): typeof fetch {
  const proxies = parseProxies();
  logger.info(`[RITU][PROXY] loaded ${proxies.length} proxies`);
  if (proxies.length === 0) {
    return global.fetch;
  }
  const idx = currentCounter.value % proxies.length;
  currentCounter.value += 1;
  const proxy = proxies[idx];
  if (!proxy) return global.fetch;
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
    : `${encodeURIComponent(proxy.password)}@`;
  const agent = new HttpsProxyAgent(`http://${auth}${proxy.host}:${proxy.port}`);

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
