import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  let listeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    listeners = [];
    localStorage.clear();
    document.documentElement.dataset.theme = "light";

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_type: string, listener: (e: { matches: boolean }) => void) => {
          listeners.push(listener);
        }),
        removeEventListener: vi.fn((_type: string, listener: (e: { matches: boolean }) => void) => {
          listeners = listeners.filter((l) => l !== listener);
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("renders button with accessible label and title", () => {
    render(<ThemeToggle label="Switch color theme" />);
    const button = screen.getByRole("button", { name: "Switch color theme" });
    expect(button).toBeDefined();
    expect(button.getAttribute("title")).toBe("Switch color theme");
  });

  it("toggles dataset.theme on click and persists to localStorage", () => {
    render(<ThemeToggle label="Switch color theme" />);
    const button = screen.getByRole("button", { name: "Switch color theme" });

    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("switches dataset.theme even if localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });

    render(<ThemeToggle label="Switch color theme" />);
    const button = screen.getByRole("button", { name: "Switch color theme" });

    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("subscribes to media query and updates dataset.theme when no override is stored", () => {
    render(<ThemeToggle label="Switch color theme" />);
    expect(listeners.length).toBe(1);

    listeners[0]({ matches: true });
    expect(document.documentElement.dataset.theme).toBe("dark");

    listeners[0]({ matches: false });
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores OS media query changes after user explicitly toggles theme", () => {
    render(<ThemeToggle label="Switch color theme" />);
    const button = screen.getByRole("button", { name: "Switch color theme" });

    // Explicit toggle
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    // OS fires light mode event
    if (listeners[0]) {
      listeners[0]({ matches: false });
    }
    // Should still remain dark
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
