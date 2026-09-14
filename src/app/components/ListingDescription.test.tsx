import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ListingDescription from "./ListingDescription";

function open(container: HTMLElement) {
  const details = container.querySelector("details");
  if (!details) throw new Error("details element not found");
  details.open = true;
  fireEvent(details, new Event("toggle", { bubbles: true }));
  return details;
}

describe("ListingDescription", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "en"),
      setItem: vi.fn(),
    } as unknown as Storage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("idle: summary present, no pre rendered", () => {
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    expect(container.textContent).toContain("Original description");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("loading: never-resolving fetch shows loading text", () => {
    const promise = new Promise<Response>(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => promise),
    );
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    open(container);
    expect(container.textContent).toContain("Loading description…");
  });

  it("done+text: renders pre with description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ description: "Line 1\nLine 2" }), { status: 200 }),
        ),
      ),
    );
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    open(container);
    await vi.waitFor(() => {
      expect(container.querySelector("pre")?.textContent).toBe("Line 1\nLine 2");
    });
  });

  it("done+null: shows no description message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ description: null }), { status: 200 })),
      ),
    );
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    open(container);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("No description available.");
    });
  });

  it("error: 502 response shows error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 502 }))),
    );
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    open(container);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Could not load description.");
    });
  });

  it("re-toggle after done does not refetch", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ description: "once" }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ListingDescription marketplace="ricardo" id="abc" />);
    const details = open(container);
    await vi.waitFor(() => {
      expect(container.textContent).toContain("once");
    });
    details.open = false;
    fireEvent(details, new Event("toggle", { bubbles: true }));
    details.open = true;
    fireEvent(details, new Event("toggle", { bubbles: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
