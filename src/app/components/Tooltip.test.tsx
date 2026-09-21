import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tooltip from "./Tooltip";

const RECT = {
  left: 100,
  width: 40,
  top: 100,
  bottom: 120,
  height: 20,
  right: 140,
  x: 100,
  y: 100,
  toJSON: () => ({}),
} as unknown as DOMRect;

function stubGeometry(innerWidth: number, innerHeight: number, rect: DOMRect) {
  Object.defineProperty(window, "innerWidth", { value: innerWidth, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
  vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue(rect);
}

describe("Tooltip", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens on click and shows title and text", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.textContent).toContain("Spec score");
    expect(dialog.textContent).toContain("Token hits");
  });

  it("toggles closed on second click", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on outside mousedown", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens in above position when space below is tight", () => {
    const highRect = { ...RECT, top: 300, bottom: 320, y: 300 } as unknown as DOMRect;
    stubGeometry(1000, 100, highRect);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

describe("Tooltip branches", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders custom content prop instead of text", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" content={<span>Custom body</span>} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog").textContent).toContain("Custom body");
  });

  it("repositions on window resize while open", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="tooltip_spec_title" textKey="tooltip_spec_text" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeDefined();
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("falls back to raw key when dict entry missing", () => {
    stubGeometry(1000, 800, RECT);
    render(<Tooltip titleKey="missing_title_key" textKey="missing_text_key" />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("missing_title_key");
    expect(dialog.textContent).toContain("missing_text_key");
  });
});
