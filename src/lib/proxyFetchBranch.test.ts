import { afterEach, describe, expect, it, vi } from "vitest";
import { getProxyFetch } from "./proxyFetch";

vi.mock("node:https", () => ({
  default: { request: vi.fn() },
}));

type ResLike = {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, unknown>;
  setEncoding: () => void;
  on: (ev: string, fn: (c?: unknown) => void) => void;
};

function mockRequestImpl(
  https: { request: ReturnType<typeof vi.fn> },
  onRequest: (
    opts: unknown,
    cb: (res: ResLike) => void,
  ) => {
    error: (e: Error) => void;
  },
) {
  https.request.mockImplementation((opts: unknown, cb: (res: ResLike) => void) => {
    const handle = onRequest(opts, cb);
    return {
      on: (_ev: string, fn: (e: Error) => void) => {
        handle.error = fn;
        return {};
      },
      write: vi.fn(),
      end: vi.fn(),
    } as never;
  });
}

describe("proxyFetch branch extensions", () => {
  afterEach(() => {
    delete process.env.PROXY_LIST;
    vi.clearAllMocks();
  });

  it("skips malformed proxy entries without host or port", async () => {
    const https = (await import("node:https")).default;
    process.env.PROXY_LIST = "nocolonentry, : , host:8080:user:pw";
    const fetcher = getProxyFetch();
    expect(fetcher).not.toBe(global.fetch);
    expect(https.request).not.toHaveBeenCalled();
  });

  it("supports password-only auth and passwords containing colons", () => {
    process.env.PROXY_LIST = "host:8080::secret";
    expect(getProxyFetch()).not.toBe(global.fetch);
    process.env.PROXY_LIST = "host:8080:user:pass:with:colons";
    expect(getProxyFetch()).not.toBe(global.fetch);
  });

  it("resolves URL and Request inputs and maps status/headers", async () => {
    const https = (await import("node:https")).default;
    const callbacks: Array<(res: ResLike) => void> = [];
    mockRequestImpl(https as never, (_opts, cb) => {
      callbacks.push(cb);
      return { error: (_e: Error) => {} };
    });
    process.env.PROXY_LIST = "host:8080:user:pw";
    const fetcher = getProxyFetch();
    const pending = fetcher(new URL("https://example.com/path?q=1"), {
      method: "POST",
      body: "hi",
    });
    const first = callbacks[0];
    if (!first) throw new Error("no request callback");
    const listeners: Record<string, Array<(c?: unknown) => void>> = {};
    first({
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "text/plain", "x-multi": ["a", "b"] },
      setEncoding: () => {},
      on: (ev: string, fn: (c?: unknown) => void) => {
        const list = listeners[ev];
        if (list) list.push(fn);
        else listeners[ev] = [fn];
      },
    });
    const dataHandlers = listeners.data ?? [];
    for (const fn of dataHandlers) fn("hello");
    const endHandlers = listeners.end ?? [];
    for (const fn of endHandlers) fn();
    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.headers.get("x-multi")).toBe("a, b");
    expect(await res.text()).toBe("hello");

    const pending2 = fetcher(new Request("https://example.com/other"));
    const second = callbacks[1];
    if (!second) throw new Error("no second request callback");
    const listeners2: Record<string, Array<(c?: unknown) => void>> = {};
    second({
      statusCode: 404,
      statusMessage: "Missing",
      headers: {},
      setEncoding: () => {},
      on: (ev: string, fn: (c?: unknown) => void) => {
        const list = listeners2[ev];
        if (list) list.push(fn);
        else listeners2[ev] = [fn];
      },
    });
    const end2 = listeners2.end ?? [];
    for (const fn of end2) fn();
    const res2 = await pending2;
    expect(res2.ok).toBe(false);
    expect(res2.status).toBe(404);
  });

  it("rejects on request error", async () => {
    const https = (await import("node:https")).default;
    const errFns: Array<(e: Error) => void> = [];
    vi.mocked(https.request).mockImplementation(
      () =>
        ({
          on: (_ev: string, fn: (e: Error) => void) => {
            errFns.push(fn);
            return {};
          },
          write: vi.fn(),
          end: vi.fn(),
        }) as never,
    );
    process.env.PROXY_LIST = "host:8080:user:pw";
    const pending = getProxyFetch()("https://example.com/x");
    const fail = errFns[0];
    if (!fail) throw new Error("no error handler");
    fail(new Error("conn refused"));
    await expect(pending).rejects.toThrow("conn refused");
  });
});
