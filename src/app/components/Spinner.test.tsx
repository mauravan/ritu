import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Spinner from "./Spinner";

describe("Spinner", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders loading image with given size", () => {
    render(<Spinner size={30} />);
    const img = screen.getByRole("img", { name: "Loading" });
    expect(img.getAttribute("width")).toBe("30");
    expect(img.getAttribute("height")).toBe("30");
  });
});
