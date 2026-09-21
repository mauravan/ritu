import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DerivedSpec } from "@/lib/types";
import SpecPanel from "./SpecPanel";

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "Compact desktop",
  requirements: [
    { key: "ram", value: "16GB", importance: "required" },
    { key: "color", value: "black", importance: "preferred" },
  ],
  searchQueries: ["mini pc"],
  excludedTerms: ["gaming"],
};

describe("SpecPanel", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders category, badges and excluded terms", () => {
    const { container } = render(<SpecPanel spec={SPEC} />);
    expect(screen.getByText(/Mini PC/)).toBeDefined();
    expect(screen.getByText("Compact desktop")).toBeDefined();
    const spans = [...container.querySelectorAll("span.bracket-tag")];
    const required = spans.find((s) => s.textContent?.includes("16GB"));
    const preferred = spans.find((s) => s.textContent?.includes("black"));
    expect(required?.className).toContain("border-error-text");
    expect(preferred?.className).not.toContain("border-error-text");
    expect(screen.getByText("-gaming")).toBeDefined();
  });

  it("omits excluded block when no excluded terms", () => {
    render(<SpecPanel spec={{ ...SPEC, excludedTerms: [] }} />);
    expect(screen.queryByText("excluded:")).toBeNull();
  });

  it("renders with empty requirements", () => {
    render(<SpecPanel spec={{ ...SPEC, requirements: [] }} />);
    expect(screen.getByText(/Mini PC/)).toBeDefined();
  });
});
