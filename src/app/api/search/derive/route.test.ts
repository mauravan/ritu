import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecDerivationError, ValidationError } from "@/lib/errors";
import { deriveSpecs } from "@/lib/llm/deriveSpecs";
import type { DerivedSpec } from "@/lib/types";
import { POST } from "./route";

vi.mock("@/lib/llm/deriveSpecs", () => ({ deriveSpecs: vi.fn() }));

const SPEC: DerivedSpec = {
  category: "Mini PC",
  summary: "Compact desktop",
  requirements: [{ key: "ram", value: "16GB", importance: "required" }],
  searchQueries: ["mini pc"],
  excludedTerms: [],
};

function post(body: unknown): Request {
  return new Request("http://localhost/api/search/derive", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("search derive route contracts", () => {
  beforeEach(() => {
    vi.mocked(deriveSpecs).mockResolvedValue({ ...SPEC });
  });

  it("success returns the derived spec", async () => {
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { derivedSpec: DerivedSpec };
    expect(json.derivedSpec).toEqual(SPEC);
  });

  it("validation error maps to 400 validation_error", async () => {
    vi.mocked(deriveSpecs).mockRejectedValue(new ValidationError("bad"));
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("spec derivation error maps to 502 spec_derivation_failed", async () => {
    vi.mocked(deriveSpecs).mockRejectedValue(new SpecDerivationError("boom"));
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("spec_derivation_failed");
  });

  it("unexpected error maps to 500 internal_error", async () => {
    vi.mocked(deriveSpecs).mockRejectedValue(new Error("x"));
    const res = await POST(post({ query: "mini pc" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("internal_error");
  });

  it("invalid JSON maps to 400 invalid_json", async () => {
    const res = await POST(post("not json"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_json");
  });
});
