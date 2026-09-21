import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "./Header";

vi.mock("./ThemeToggle", () => ({ default: () => <button type="button">theme</button> }));

describe("Header", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders brand and switches locale", () => {
    const spy = vi.fn((_l: "de" | "en") => {});
    render(<Header locale="en" setLocale={spy} />);
    expect(screen.getByText("ritu://market-scan")).toBeDefined();
    expect(screen.getByRole("button", { name: "English" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "German" }));
    expect(spy).toHaveBeenCalledWith("de");
  });

  it("renders german locale selected state", () => {
    const spy = vi.fn((_l: "de" | "en") => {});
    render(<Header locale="de" setLocale={spy} />);
    expect(screen.getByText("ritu://market-scan")).toBeDefined();
    expect(screen.getByRole("button", { name: "German" })).toBeDefined();
  });
});
