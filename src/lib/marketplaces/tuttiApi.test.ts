import { describe, expect, it } from "vitest";
import { parsePrice, normalizeImageUrl, listingToRawProduct } from "./tuttiApi";

describe("tuttiApi", () => {
  describe("parsePrice", () => {
    it("parses CHF prefixed prices", () => {
      expect(parsePrice("CHF 1'234.50")).toBe(1234.5);
      expect(parsePrice("CHF 650")).toBe(650);
      expect(parsePrice("chf 100.50")).toBe(100.5);
      expect(parsePrice("CHF 1'234,50")).toBe(1234.5);
    });

    it("parses Tutti API format with .- suffix", () => {
      expect(parsePrice("650.-")).toBe(650);
      expect(parsePrice("1'200.-")).toBe(1200);
      expect(parsePrice("1'234.50.-")).toBe(1234.5);
      expect(parsePrice("  650  .-  ")).toBe(650);
    });

    it("parses plain numbers as fallback", () => {
      expect(parsePrice("125")).toBe(125);
      expect(parsePrice("  650  ")).toBe(650);
    });

    it("returns null for empty or invalid input", () => {
      expect(parsePrice("")).toBeNull();
      expect(parsePrice("not a price")).toBeNull();
      expect(parsePrice(null as unknown as string)).toBeNull();
      expect(parsePrice(undefined as unknown as string)).toBeNull();
    });

    it("returns null for long non-price strings", () => {
      expect(parsePrice("this is a very long string that is not a price")).toBeNull();
    });

    it("handles Swiss number formatting", () => {
      expect(parsePrice("1'234")).toBe(1234);
      expect(parsePrice("1'234.56")).toBe(1234.56);
      expect(parsePrice("1'234,56")).toBe(1234.56);
    });
  });

  describe("normalizeImageUrl", () => {
    it("returns null for null/undefined/empty", () => {
      expect(normalizeImageUrl(null)).toBeNull();
      expect(normalizeImageUrl(undefined)).toBeNull();
      expect(normalizeImageUrl("")).toBeNull();
    });

    it("converts protocol-relative URLs", () => {
      expect(normalizeImageUrl("//example.com/image.jpg")).toBe("https://example.com/image.jpg");
    });

    it("converts absolute paths", () => {
      expect(normalizeImageUrl("/images/photo.jpg")).toBe("https://www.tutti.ch/images/photo.jpg");
    });

    it("passes through full HTTP URLs", () => {
      expect(normalizeImageUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
      expect(normalizeImageUrl("http://example.com/image.jpg")).toBe("http://example.com/image.jpg");
    });

    it("returns null for invalid URLs", () => {
      expect(normalizeImageUrl("ftp://example.com/image.jpg")).toBeNull();
      expect(normalizeImageUrl("javascript:alert(1)")).toBeNull();
    });
  });

  describe("listingToRawProduct", () => {
    const makeListing = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      listingID: "12345",
      title: "Test Product",
      formattedPrice: "CHF 100",
      images: [{ rendition: { src: "//img.example.com/photo.jpg" } }],
      postcodeInformation: { locationName: "Zurich" },
      ...overrides,
    });

    it("maps listing to RawProduct", () => {
      const listing = makeListing();
      const result = listingToRawProduct(listing as any);
      expect(result.id).toBe("12345");
      expect(result.marketplace).toBe("tutti");
      expect(result.title).toBe("Test Product");
      expect(result.priceChf).toBe(100);
      expect(result.currency).toBe("CHF");
      expect(result.condition).toBeNull();
      expect(result.imageUrl).toBe("https://img.example.com/photo.jpg");
      expect(result.url).toBe("https://www.tutti.ch/de/vi/12345");
      expect(result.location).toBe("Zurich");
      expect(result.raw).toBe(listing);
    });

    it("truncates long titles", () => {
      const listing = makeListing({ title: "a".repeat(250) });
      const result = listingToRawProduct(listing as any);
      expect(result.title.length).toBe(200);
    });

    it("uses fallback price field", () => {
      const listing = makeListing({ formattedPrice: undefined, price: "CHF 200" });
      const result = listingToRawProduct(listing as any);
      expect(result.priceChf).toBe(200);
    });

    it("uses thumbnail when images not available", () => {
      const listing = makeListing({
        images: undefined,
        thumbnail: { rendition: { src: "/thumb.jpg" } },
      });
      const result = listingToRawProduct(listing as any);
      expect(result.imageUrl).toBe("https://www.tutti.ch/thumb.jpg");
    });

    it("uses address when postcodeInformation not available", () => {
      const listing = makeListing({
        postcodeInformation: undefined,
        address: "Bern",
      });
      const result = listingToRawProduct(listing as any);
      expect(result.location).toBe("Bern");
    });

    it("handles missing fields gracefully", () => {
      const listing = makeListing({
        listingID: undefined,
        title: undefined,
        formattedPrice: undefined,
        images: undefined,
        thumbnail: undefined,
        postcodeInformation: undefined,
        address: undefined,
      });
      const result = listingToRawProduct(listing as any);
      expect(result.id).toBe("");
      expect(result.title).toBe("");
      expect(result.priceChf).toBeNull();
      expect(result.imageUrl).toBeNull();
      expect(result.location).toBeNull();
    });
  });
});