import { describe, expect, it } from "vitest";
import { extractListingImages } from "./listingImages";

describe("extractListingImages", () => {
  it("ricardo picks the largest t_WxH transformation", () => {
    const detail = {
      images: [
        {
          index: 0,
          transformations: [
            { name: "t_1000x750", url: "https://img.ricardostatic.ch/small.jpg" },
            { name: "t_1800x1350", url: "https://img.ricardostatic.ch/big.jpg" },
          ],
        },
      ],
    };
    expect(extractListingImages(detail, "ricardo")).toEqual([
      "https://img.ricardostatic.ch/big.jpg",
    ]);
  });

  it("ricardo falls back to last transformation when no t_WxH matches", () => {
    const detail = {
      images: [{ index: 0, transformations: [{ name: "thumb", url: "https://x/a.jpg" }] }],
    };
    expect(extractListingImages(detail, "ricardo")).toEqual(["https://x/a.jpg"]);
  });

  it("ricardo skips images with no usable URL", () => {
    const detail = {
      images: [
        { index: 0, transformations: [{ name: "t_100x100" }] },
        { index: 1, transformations: [] },
        "nope",
        { index: 2 },
      ],
    };
    expect(extractListingImages(detail, "ricardo")).toEqual([]);
  });

  it("tutti maps rendition.src and normalizes URLs", () => {
    const detail = {
      images: [
        { rendition: { src: "https://c.tutti.ch/big/a.jpg" } },
        { rendition: { src: "//c.tutti.ch/big/b.jpg" } },
        { rendition: { src: "/big/c.jpg" } },
        { rendition: {} },
      ],
    };
    expect(extractListingImages(detail, "tutti")).toEqual([
      "https://c.tutti.ch/big/a.jpg",
      "https://c.tutti.ch/big/b.jpg",
      "https://www.tutti.ch/big/c.jpg",
    ]);
  });

  it("returns [] for null/primitive/non-array input", () => {
    expect(extractListingImages(null, "ricardo")).toEqual([]);
    expect(extractListingImages("x", "tutti")).toEqual([]);
    expect(extractListingImages({}, "ricardo")).toEqual([]);
    expect(extractListingImages({ images: "nope" }, "tutti")).toEqual([]);
  });

  it("dedupes preserving order", () => {
    const detail = {
      images: [
        { rendition: { src: "https://c.tutti.ch/a.jpg" } },
        { rendition: { src: "https://c.tutti.ch/b.jpg" } },
        { rendition: { src: "https://c.tutti.ch/a.jpg" } },
      ],
    };
    expect(extractListingImages(detail, "tutti")).toEqual([
      "https://c.tutti.ch/a.jpg",
      "https://c.tutti.ch/b.jpg",
    ]);
  });
});
