import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useLocale from "./useLocale";

function Probe() {
  const [locale, setLocale] = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale("en")}>
        to-en
      </button>
    </div>
  );
}

describe("useLocale", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reads initial locale from storage", () => {
    render(<Probe />);
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("falls back to de for invalid stored locale", () => {
    window.localStorage.setItem("locale", "fr");
    render(<Probe />);
    expect(screen.getByTestId("locale").textContent).toBe("de");
  });

  it("ignores locale-change events with invalid detail", () => {
    render(<Probe />);
    window.dispatchEvent(new CustomEvent("locale-change", { detail: "fr" }));
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });
});
