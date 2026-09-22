import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../errors";
import { deriveSpecs, tryParseJsonFromText } from "./deriveSpecs";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(() => ({ __mockOutput: true })) },
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
      expect(tryParseJsonFromText('{"key": "value"}')).toEqual({
        key: "value",
      });
    });

    it("parses JSON with whitespace", () => {
      expect(tryParseJsonFromText('  {"key": "value"}  ')).toEqual({
        key: "value",
      });
    });

    it("parses JSON from markdown code block", () => {
      expect(tryParseJsonFromText('```json\n{"key": "value"}\n```')).toEqual({
        key: "value",
      });
    });

    it("parses JSON from markdown code block without language", () => {
      expect(tryParseJsonFromText('```\n{"key": "value"}\n```')).toEqual({
        key: "value",
      });
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

    it("returns spec from generateText", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(validSpec),
      } as never);
      const result = await deriveSpecs("laptop for school");
      expect(result).toEqual(validSpec);
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(Output.object).toHaveBeenCalledTimes(1);
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mock-openai:openai/gpt-4o-mini",
          maxRetries: 0,
          maxOutputTokens: 1500,
          timeout: 15000,
          providerOptions: { openai: { forceReasoning: true, reasoningEffort: "minimal" } },
        }),
      );
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://openrouter.ai/api/v1",
      });
    });

    it("falls back to fallback model when primary fails", async () => {
      vi.stubEnv("LLM_MODEL", "primary-model");
      vi.stubEnv("LLM_FALLBACK_MODEL", "fallback-model");
      vi.mocked(generateText)
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({
          text: JSON.stringify(validSpec),
        } as never);
      const result = await deriveSpecs("laptop for school");
      expect(result).toEqual(validSpec);
      expect(generateText).toHaveBeenCalledTimes(2);
      const firstCall = vi.mocked(generateText).mock.calls[0][0] as {
        model: string;
      };
      const secondCall = vi.mocked(generateText).mock.calls[1][0] as {
        model: string;
      };
      expect(firstCall.model).toBe("mock-openai:primary-model");
      expect(secondCall.model).toBe("mock-openai:fallback-model");
    });

    it("throws when both models return unparseable text", async () => {
      vi.stubEnv("LLM_MODEL", "primary-model");
      vi.stubEnv("LLM_FALLBACK_MODEL", "fallback-model");
      vi.mocked(generateText).mockResolvedValue({
        text: "not json at all",
      } as never);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow("All LLM attempts failed");
      expect(generateText).toHaveBeenCalledTimes(2);
    });

    it("throws ValidationError when generateText returns invalid schema", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({ category: "laptop", missing: true }),
      } as never);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(ValidationError);
      await expect(deriveSpecs("laptop for school")).rejects.toThrow(
        "LLM response validation failed",
      );
    });

    it("rethrows ValidationError from last attempt", async () => {
      const validationError = new ValidationError("text validation failed");
      vi.mocked(generateText).mockRejectedValue(validationError);
      await expect(deriveSpecs("laptop for school")).rejects.toBe(validationError);
    });

    it("throws when both attempts reject with generic error", async () => {
      vi.mocked(generateText).mockRejectedValue(new Error("network down"));
      await expect(deriveSpecs("laptop for school")).rejects.toThrow("All LLM attempts failed");
    });

    it("handles non-Error rejections from both attempts", async () => {
      vi.mocked(generateText).mockRejectedValue("plain string error");
      await expect(deriveSpecs("laptop for school")).rejects.toThrow("All LLM attempts failed");
    });

    it("includes clarifyingAnswer in prompt", async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(validSpec),
      } as never);
      await deriveSpecs("laptop for school", "budget 800 CHF");
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Original request: laptop for school"),
        }),
      );
      const call = vi.mocked(generateText).mock.calls[0][0] as {
        prompt: string;
      };
      expect(call.prompt).toContain("Clarifying context from user: budget 800 CHF");
    });

    it("truncates input to 500 chars", async () => {
      const longInput = "a".repeat(600);
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(validSpec),
      } as never);
      await deriveSpecs(longInput);
      const call = vi.mocked(generateText).mock.calls[0][0] as {
        prompt: string;
      };
      expect(call.prompt.length).toBeLessThanOrEqual(500);
    });

    it("uses env baseURL and model when set", async () => {
      vi.stubEnv("LLM_BASE_URL", "https://custom.example.com");
      vi.stubEnv("LLM_MODEL", "custom-model");
      vi.stubEnv("LLM_FALLBACK_MODEL", "custom-model");
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(validSpec),
      } as never);
      await deriveSpecs("laptop");
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: "test-key",
        baseURL: "https://custom.example.com",
      });
      expect(generateText).toHaveBeenCalledTimes(1);
      const call = vi.mocked(generateText).mock.calls[0][0] as {
        model: string;
      };
      expect(call.model).toBe("mock-openai:custom-model");
    });
  });
});
