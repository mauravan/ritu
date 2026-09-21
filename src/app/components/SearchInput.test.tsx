import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("calls setQuery on typing with label and placeholder", () => {
    const spy = vi.fn((_q: string) => {});
    render(
      <SearchInput
        query=""
        setQuery={spy}
        disabled={false}
        placeholder="Describe it"
        label="What are you looking for?"
      />,
    );
    const box = screen.getByRole("textbox", { name: "What are you looking for?" });
    expect(box.getAttribute("placeholder")).toBe("Describe it");
    fireEvent.change(box, { target: { value: "mini pc" } });
    expect(spy).toHaveBeenCalledWith("mini pc");
  });

  it("disables input when disabled", () => {
    const spy = vi.fn((_q: string) => {});
    render(
      <SearchInput
        query="x"
        setQuery={spy}
        disabled={true}
        placeholder="Describe it"
        label="What are you looking for?"
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "What are you looking for?" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
