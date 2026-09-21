import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import QueryList from "./QueryList";

describe("QueryList", () => {
  beforeEach(() => {
    window.localStorage.setItem("locale", "en");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders ricardo and tutti groups with links and counts", () => {
    render(
      <QueryList
        queries={[
          { marketplace: "ricardo", query: "mini pc", url: "https://ricardo" },
          { marketplace: "tutti", query: "mini pc", url: "https://tutti" },
        ]}
      />,
    );
    expect(screen.getByText(/ricardo/)).toBeDefined();
    expect(screen.getByText(/tutti/)).toBeDefined();
    const links = screen.getAllByRole("link", { name: /mini pc/i });
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://ricardo");
    expect(hrefs).toContain("https://tutti");
    for (const a of links) expect(a.getAttribute("target")).toBe("_blank");
    expect(screen.getAllByText(/1 queries/).length).toBe(2);
  });
  it("renders empty groups with zero counts without throwing", () => {
    render(<QueryList queries={[]} />);
    expect(screen.getByText(/ricardo/)).toBeDefined();
    expect(screen.getByText(/tutti/)).toBeDefined();
    expect(screen.getAllByText(/0 queries/).length).toBe(2);
  });
});
