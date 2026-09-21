import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders note and version", () => {
    render(<Footer dict={{ footer_note: "Find anything" }} version="1.0.5" />);
    expect(screen.getByText("Find anything")).toBeDefined();
    expect(screen.getByText("v1.0.5")).toBeDefined();
  });
});
