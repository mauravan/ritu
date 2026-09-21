import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoadingButton from "./LoadingButton";

describe("LoadingButton", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("calls onClick and shows children when idle", () => {
    const spy = vi.fn(() => {});
    render(
      <LoadingButton isLoading={false} onClick={spy}>
        Go
      </LoadingButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(spy).toHaveBeenCalledOnce();
    expect(screen.getByText("Go")).toBeDefined();
  });

  it("shows spinner, hides children and disables when loading", () => {
    render(
      <LoadingButton isLoading={true} onClick={() => {}}>
        Go
      </LoadingButton>,
    );
    expect(screen.getByRole("img", { name: "Loading" })).toBeDefined();
    expect(screen.queryByText("Go")).toBeNull();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });
});
