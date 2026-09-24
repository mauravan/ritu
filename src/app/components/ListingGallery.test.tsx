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
    fireEvent.click(screen.getByRole("button", { name: /^View photos:/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    expect(screen.getByText("1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("2 of 3")).toBeTruthy();
  });

  it("open + error: shows error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502 })),
    );
    render(<ListingGallery {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^View photos:/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Could not load photos.");
  });

  it("Escape closes the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ images: ["https://a/1.jpg"] }),
      })),
    );
    render(<ListingGallery {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^View photos:/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("null coverUrl: no button, No image text, no dialog", () => {
    render(<ListingGallery marketplace="ricardo" id="abc" title="Test item" coverUrl={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No image")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
