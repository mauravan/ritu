import { describe, expect, it } from "vitest";
import { extractListingDescription, formatListingDescription } from "./listingDescription";

describe("extractListingDescription", () => {
  it("extracts ricardo description", () => {
    expect(extractListingDescription({ description: "hi" }, "ricardo")).toBe("hi");
  });

  it("returns null for whitespace-only ricardo description", () => {
    expect(extractListingDescription({ description: "  " }, "ricardo")).toBeNull();
  });

  it("returns null when ricardo description key missing", () => {
    expect(extractListingDescription({ title: "x" }, "ricardo")).toBeNull();
  });

  it("extracts tutti body", () => {
    expect(extractListingDescription({ body: "b" }, "tutti")).toBe("b");
  });

  it("returns null for non-string tutti body", () => {
    expect(extractListingDescription({ body: 123 }, "tutti")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractListingDescription(null, "ricardo")).toBeNull();
  });

  it("returns null for primitive input", () => {
    expect(extractListingDescription("str", "ricardo")).toBeNull();
  });
});

describe("formatListingDescription", () => {
  it("passes through plain text", () => {
    expect(formatListingDescription("Hello world")).toBe("Hello world");
  });

  it("converts br variants to newlines", () => {
    expect(formatListingDescription("a<br>b<br/>c")).toBe("a\nb\nc");
  });

  it("converts paragraph closes to newlines", () => {
    expect(formatListingDescription("<p>a</p><p>b</p>")).toBe("a\nb");
  });

  it("converts list items to newlines", () => {
    expect(formatListingDescription("<ul><li>x</li><li>y</li></ul>")).toBe("x\ny");
  });

  it("decodes common entities", () => {
    expect(formatListingDescription("a &amp; b &lt;tag&gt; &quot;q&quot; &#39;s&#39; &nbsp;")).toBe(
      "a & b <tag> \"q\" 's'",
    );
  });

  it("trims outer whitespace", () => {
    expect(formatListingDescription("<p>Hi</p>")).toBe("Hi");
  });

  it("collapses runs of 3+ newlines to 2", () => {
    expect(formatListingDescription("a   \nb\n\n\nc")).toBe("a\nb\n\nc");
  });
});
