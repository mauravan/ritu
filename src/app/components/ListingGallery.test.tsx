import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListingGallery from "./ListingGallery";

vi.mock("./useLocale", () => ({ default: () => ["en" as const, () => {}] }));

const props = {
  marketplace: "ricardo" as const,
  id: "abc",
  title: "Test item",
  coverUrl: "https://a/1.jpg",
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /^View photos:/ }));
  return waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
}

function swipe(dx: number) {
  const dialog = screen.getByRole("dialog");
  fireEvent.touchStart(dialog, { touches: [{ clientX: 100 }] });
  fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 100 + dx }] });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("ListingGallery", () => {
  it("idle: trigger button with badge, no dialog", () => {
    render(<ListingGallery {...props} />);
    const btn = screen.getByRole("button", { name: /^View photos:/ });
    expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
    expect(btn.textContent).toContain("Photos");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open + success: dialog, counter, next navigates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    await openDialog();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("open + error: shows error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502 })),
    );
    render(<ListingGallery {...props} />);
    await openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Could not load photos.");
  });

  it("thumbnail image error: shows no-image fallback", () => {
    render(<ListingGallery {...props} />);
    const img = screen.getByAltText("Test item");
    fireEvent.error(img);
    expect(screen.getByText("No image")).toBeTruthy();
  });

  it("keyboard: arrows navigate, Escape closes and restores scroll", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg", "https://a/2.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    const trigger = screen.getByRole("button", { name: /^View photos:/ });
    await openDialog();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeTruthy());
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("2 of 2")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("1 of 2")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("close button and backdrop click close the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await openDialog();
    const backdrop = screen.getByRole("dialog").parentElement;
    if (!backdrop) throw new Error("backdrop not found");
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();

    // Inner clicks do not close.
    await openDialog();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("swipe: left goes next, right goes prev, small swipe ignored", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg", "https://a/2.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    await openDialog();
    swipe(-60);
    expect(screen.getByText("2 of 2")).toBeTruthy();
    swipe(60);
    expect(screen.getByText("1 of 2")).toBeTruthy();
    swipe(10);
    expect(screen.getByText("1 of 2")).toBeTruthy();
  });

  it("Tab trap: wraps focus from last to first and back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg", "https://a/2.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    await openDialog();
    await waitFor(() => expect(screen.getByText("1 of 2")).toBeTruthy());
    const dialog = screen.getByRole("dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("stale images do not refetch on reopen", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ images: ["https://a/1.jpg"] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ListingGallery {...props} />);
    await openDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    await openDialog();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("null coverUrl: no button, No image text, no dialog", () => {
    render(<ListingGallery marketplace="ricardo" id="abc" title="Test item" coverUrl={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No image")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
