import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Platform } from "@/lib/types";
import PlatformSelect from "./PlatformSelect";

const DICT = {
  marketplace_label: "Marketplace",
  platform_both: "Both",
  platform_ricardo: "Ricardo",
  platform_tutti: "Tutti",
};

describe("PlatformSelect", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("calls setPlatform for each button", () => {
    const spy = vi.fn((_p: Platform) => {});
    render(<PlatformSelect platform="both" setPlatform={spy} dict={DICT} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Both" }));
    expect(spy).toHaveBeenCalledWith("both");
    fireEvent.click(screen.getByRole("button", { name: "Ricardo" }));
    expect(spy).toHaveBeenCalledWith("ricardo");
    fireEvent.click(screen.getByRole("button", { name: "Tutti" }));
    expect(spy).toHaveBeenCalledWith("tutti");
  });

  it("disables all buttons when disabled", () => {
    const spy = vi.fn((_p: Platform) => {});
    render(<PlatformSelect platform="both" setPlatform={spy} dict={DICT} disabled={true} />);
    for (const name of ["Both", "Ricardo", "Tutti"]) {
      expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("falls back to key and default label without dict", () => {
    const spy = vi.fn((_p: Platform) => {});
    render(<PlatformSelect platform="tutti" setPlatform={spy} dict={{}} disabled={false} />);
    expect(screen.getByRole("button", { name: "both" })).toBeDefined();
    expect(screen.getByRole("button", { name: "tutti" }).getAttribute("aria-pressed")).toBe("true");
  });
});
