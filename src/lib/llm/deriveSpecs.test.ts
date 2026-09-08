import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => () => "mock-model",
}));

import { deriveSpecs } from "./deriveSpecs";
import { ValidationError, SpecDerivationError } from "../errors";

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

  it("throws SpecDerivationError if no API key", async () => {
    delete process.env.LLM_API_KEY;
    await expect(deriveSpecs("valid query here")).rejects.toBeInstanceOf(SpecDerivationError);
  });

  it("wraps LLM failure in SpecDerivationError", async () => {
    mockGenerateObject.mockRejectedValue(new Error("network fail"));
    await expect(deriveSpecs("valid query here")).rejects.toBeInstanceOf(SpecDerivationError);
  });

  it("truncates input to 500 chars", async () => {
    mockGenerateObject.mockResolvedValue({ object: cannedSpec });
    const long = "a".repeat(600);
    await deriveSpecs(long);
    const call = mockGenerateObject.mock.calls[0]![0] as { prompt: string };
    expect(call.prompt.length).toBe(500);
  });
});
