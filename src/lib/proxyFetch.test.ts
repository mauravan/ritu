import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";
import { getProxyFetch } from "./proxyFetch";

vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("proxyFetch", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.PROXY_LIST;
  });

  it("returns global fetch and logs 0 proxies when PROXY_LIST missing", () => {
    delete process.env.PROXY_LIST;
    const result = getProxyFetch();
    expect(result).toBe(global.fetch);
    expect(logger.info).toHaveBeenCalledWith("[RITU][PROXY] loaded 0 proxies");
  });

  it("loads proxies and logs count when PROXY_LIST set", () => {
    process.env.PROXY_LIST = "proxy1:8080:user1:pass1,proxy2:8081:user2:pass2";
    const result = getProxyFetch();
    expect(result).not.toBe(global.fetch);
    expect(logger.info).toHaveBeenCalledWith("[RITU][PROXY] loaded 2 proxies");
  });

  it("ignores empty entries in comma-separated PROXY_LIST", () => {
    process.env.PROXY_LIST = ",host:8080:user:pw,,";
    const result = getProxyFetch();
    expect(result).not.toBe(global.fetch);
    expect(logger.info).toHaveBeenCalledWith("[RITU][PROXY] loaded 1 proxies");
  });

  it("rotates through proxies on successive calls", () => {
    process.env.PROXY_LIST = "host:8080:user:pw";
    getProxyFetch();
    getProxyFetch();
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it("parses 4-part proxy with username and password", () => {
    process.env.PROXY_LIST = "host:8080:myuser:mypass";
    const result = getProxyFetch();
    expect(result).not.toBe(global.fetch);
    expect(logger.info).toHaveBeenCalledWith("[RITU][PROXY] loaded 1 proxies");
  });
});
