import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { ValidationError } from "../errors";
import { deriveSpecs, tryParseJsonFromText } from "./deriveSpecs";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => `mock-openai:${model}`),
}));

const validSpec = {
  category: "laptop",
  summary: "User needs a laptop for school",
  requirements: [{ key: "cpu", value: "i7", importance: "required" }],
  searchQueries: ["laptop i7", "notebook"],
  excludedTerms: ["sleeve", "case"],
};

describe("deriveSpecs", () => {
  describe("tryParseJsonFromText", () => {
    it("parses direct JSON", () => {
      expect(tryParseJsonFromText('{"key": "value"}')).toEqual({ key: "value" });
    });

    it("parses JSON with whitespace", () => {
      expect(tryParseJsonFromText('  {"key": "value"}  ')).toEqual({ key: "value" });
    });

    it("parses JSON from markdown code block", () => {
      expect(tryParseJsonFromText('```json\n{"key": "value"}\n```')).toEqual({
        key: "value",
      });
    });

    it("parses JSON from markdown code block without language", () => {
      expect(tryParseJsonFromText('```\n{"key": "value"}\n```')).toEqual({ key: "value" });
    });

    it("extracts JSON from text with first/last brace", () => {
      expect(tryParseJsonFromText('some text {"key": "value"} more text')).toEqual({
        key: "value",
      });
    });

    it("handles nested braces", () => {
      expect(tryParseJsonFromText('text {"outer": {"inner": "value"}} end')).toEqual({
        outer: { inner: "value" },
      });
    });

    it("returns null for invalid JSON", () => {
      expect(tryParseJsonFromText("not json at all")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(tryParseJsonFromText("")).toBeNull();
    });

    it("returns null for unparseable code block", () => {
      expect(tryParseJsonFromText("```json\nnot json\n```")).toBeNull();
    });

    it("handles array JSON", () => {
      expect(tryParseJsonFromText("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("handles number JSON", () => {
      expect(tryParseJsonFromText("42")).toBe(42);
    });
  });

  describe("deriveSpecs", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("LLM_API_KEY", "test-key");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws ValidationError for input shorter than 3 chars", async () => {
      await expect(deriveSpecs("ab")).rejects.toThrow(ValidationError);
      await expect(deriveSpecs("ab")).rejects.toThrow("Input too short");
    });

    it("throws Error when LLM_API_KEY missing", async () => {
      vi.stubEnv("LLM_API_KEY", undefined);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow("LLM_API_KEY missing");
    });

    it("returns object from generateObject on first attempt", async () => {
      vi.mocked(generateObject).mockResolvedValue({ object: validSpec } as never);
      const result = await deriveSpecs("laptop for school");
      expect(result).toEqual(validSpec);
      expect(generateObject).toHaveBeenCalledTimes(1);
      expect(generateText).not.toHaveBeenCalled();
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://openrouter.ai/api/v1",
      });
    });

    it("falls back to generateText when generateObject throws generic error", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("model does not support structured"));
      vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(validSpec) } as never);
      const result = await deriveSpecs("laptop for school");
      expect(result).toEqual(validSpec);
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it("rethrows ValidationError from generateObject", async () => {
      const validationError = new ValidationError("bad schema");
      vi.mocked(generateObject).mockRejectedValue(validationError);
      await expect(deriveSpecs("laptop for school")).rejects.toBe(validationError);
      expect(generateText).not.toHaveBeenCalled();
    });

    it("throws ValidationError when generateText returns invalid schema", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("no structured"));
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({ category: "laptop", missing: true }),
      } as never);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(ValidationError);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(
        "LLM response validation failed",
      );
    });

    it("throws fallback error when generateText returns unparseable text", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("no structured"));
      vi.mocked(generateText).mockResolvedValue({ text: "not json at all" } as never);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(
        "All LLM attempts failed",
      );
    });

    it("rethrows ValidationError from generateText", async () => {
      const validationError = new ValidationError("text validation failed");
      vi.mocked(generateObject).mockRejectedValue(new Error("no structured"));
      vi.mocked(generateText).mockRejectedValue(validationError);
      await expect(deriveSpecs("laptop for school")).rejects.toBe(validationError);
    });

    it("throws fallback error when generateText rejects with generic error", async () => {
      vi.mocked(generateObject).mockRejectedValue(new Error("no structured"));
      vi.mocked(generateText).mockRejectedValue(new Error("network down"));
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(
        "All LLM attempts failed",
      );
    });

    it("handles non-Error rejections from both attempts", async () => {
      vi.mocked(generateObject).mockRejectedValue("plain string error");
      vi.mocked(generateText).mockRejectedValue("another plain string");
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(
        "All LLM attempts failed",
      );
    });

    it("includes clarifyingAnswer in prompt", async () => {
      vi.mocked(generateObject).mockResolvedValue({ object: validSpec } as never);
      await deriveSpecs("laptop for school", "budget 800 CHF");
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Original request: laptop for school"),
        }),
      );
      const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain("Clarifying context from user: budget 800 CHF");
    });

    it("truncates input to 500 chars", async () => {
      const longInput = "a".repeat(600);
      vi.mocked(generateObject).mockResolvedValue({ object: validSpec } as never);
      await deriveSpecs(longInput);
      const call = vi.mocked(generateObject).mock.calls[0][0] as { prompt: string };
      expect(call.prompt.length).toBeLessThanOrEqual(500);
    });

    it("uses env baseURL and model when set", async () => {
      vi.stubEnv("LLM_BASE_URL", "https://custom.example.com");
      vi.stubEnv("LLM_MODEL", "custom-model");
      vi.mocked(generateObject).mockResolvedValue({ object: validSpec } as never);
      await deriveSpecs("laptop");
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://custom.example.com",
      });
      const call = vi.mocked(generateObject).mock.calls[0][0] as { model: string };
      expect(call.model).toBe("mock-openai:custom-model");
    });
  });
});
