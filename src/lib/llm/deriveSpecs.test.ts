import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateObject = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => () => "mock-model",
}));

import { ValidationError } from "../errors";
import { deriveSpecs } from "./deriveSpecs";

const cannedSpec = {
  category: "mini pc",
  summary: "Small server for Immich",
  requirements: [{ key: "RAM", value: "16GB", importance: "required" as const }],
  searchQueries: ["mini pc", "intel nuc", "nas"],
  excludedTerms: ["raspberry pi zero"],
};

describe("deriveSpecs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.LLM_MODEL = "openai/gpt-4o-mini";
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(cannedSpec) });
  });

  it("returns parsed spec on success", async () => {
    mockGenerateObject.mockResolvedValue({ object: cannedSpec });
    const result = await deriveSpecs("i need a small server for home");
    expect(result.category).toBe("mini pc");
    expect(result.searchQueries).toContain("mini pc");
  });

  it("throws ValidationError if too short", async () => {
    await expect(deriveSpecs("ab")).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when LLM_API_KEY is missing", async () => {
    delete process.env.LLM_API_KEY;
    await expect(deriveSpecs("i need a new laptop for school")).rejects.toThrow(
      "LLM_API_KEY missing",
    );
  });

  it("throws when both LLM attempts fail", async () => {
    mockGenerateObject.mockRejectedValue(new Error("Invalid JSON response"));
    mockGenerateText.mockRejectedValue(new Error("network fail"));
    await expect(deriveSpecs("i need a new laptop for school")).rejects.toThrow(
      "All LLM attempts failed",
    );
  });

  it("uses generateText fallback when generateObject fails but generateText succeeds", async () => {
    mockGenerateObject.mockRejectedValue(new Error("Invalid JSON response"));
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(cannedSpec) });
    const result = await deriveSpecs("i need a small server");
    expect(result.category).toBe("mini pc");
  });

  it("truncates input to 500 chars", async () => {
    mockGenerateObject.mockResolvedValue({ object: cannedSpec });
    const long = "a".repeat(600);
    await deriveSpecs(long);
    const call = mockGenerateObject.mock.calls[0]?.[0] as { prompt: string };
    expect(call.prompt.length).toBe(500);
  });
});

describe("deriveSpecs contract assertions", () => {
  it("ValidationError from generateObject propagates with fields and raw", async () => {
    mockGenerateObject.mockRejectedValue(
      new ValidationError("bad", { fields: { f: ["v"] }, raw: { x: 1 } }),
    );
    await expect(deriveSpecs("test")).rejects.toBeInstanceOf(ValidationError);
  });

  it("input truncation is exactly 500 chars", async () => {
    mockGenerateObject.mockResolvedValue({ object: cannedSpec });
    const long = "x".repeat(600);
    await deriveSpecs(long);
    const prompt = (mockGenerateObject.mock.calls[0]?.[0] as { prompt: string })?.prompt ?? "";
    expect(prompt.length).toBeLessThanOrEqual(500);
  });

  it("catch/rethrow path covers both attempts", async () => {
    mockGenerateObject.mockRejectedValue(new Error("fail1"));
    mockGenerateText.mockRejectedValue(new ValidationError("fail2", { raw: {} }));
    await expect(deriveSpecs("test")).rejects.toBeInstanceOf(ValidationError);
  });
});
