import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SortBy, SortDir } from "@/lib/types";
import SortSelect from "./SortSelect";

describe("SortSelect", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("calls onChange with desc for each unselected field", () => {
    for (const field of ["spec", "value", "ai", "price"] as SortBy[]) {
      cleanup();
      const spy = vi.fn((_by: SortBy, _dir: SortDir) => {});
      render(<SortSelect by="hybrid" dir="desc" onChange={spy} dict={{}} />);
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Sort by ${field}`, "i") }));
      expect(spy).toHaveBeenCalledWith(field, "desc");
    }
  });

  it("shows ascending arrow and custom dict labels", () => {
    const spy = vi.fn((_by: SortBy, _dir: SortDir) => {});
    render(
      <SortSelect
        by="price"
        dir="asc"
        onChange={spy}
        dict={{
          sort_label: "order",
          sort_price: "preis",
          sort_asc: "auf",
          sort_aria: "Sort {label}",
        }}
      />,
    );
    const price = screen.getByRole("button", { name: /preis/i });
    expect(price.getAttribute("aria-pressed")).toBe("true");
    expect(price.textContent).toContain("↑");
    expect(screen.getByText("order")).toBeDefined();
  });

  it("marks selected button pressed with arrow and flips dir on click", () => {
    const spy = vi.fn((_by: SortBy, _dir: SortDir) => {});
    render(<SortSelect by="hybrid" dir="desc" onChange={spy} dict={{}} />);
    const hybrid = screen.getByRole("button", { name: /hybrid/i });
    expect(hybrid.getAttribute("aria-pressed")).toBe("true");
    expect(hybrid.textContent).toContain("↓");
    fireEvent.click(hybrid);
    expect(spy).toHaveBeenCalledWith("hybrid", "asc");
  });
});
