import { describe, it, expect } from "vitest";
import { DerivedSpecSchema, AuthContextSchema } from "./schemas";

describe("DerivedSpecSchema", () => {
  const validSpec = {
    category: "mini pc",
    summary: "Small server for Immich",
    requirements: [{ key: "RAM", value: "16GB", importance: "required" as const }],
    searchQueries: ["mini pc 16GB", "intel nuc"],
    excludedTerms: ["raspberry pi"],
  };

  it("parses valid spec", () => {
    expect(() => DerivedSpecSchema.parse(validSpec)).not.toThrow();
  });

  it("rejects missing searchQueries", () => {
    const { searchQueries: _omit, ...without } = validSpec;
    void _omit;
    expect(() => DerivedSpecSchema.parse(without)).toThrow();
  });

  it("rejects extra fields due to strict", () => {
    expect(() => DerivedSpecSchema.parse({ ...validSpec, extra: 123 })).toThrow();
  });
});

describe("AuthContextSchema", () => {
  it("accepts null", () => {
    expect(() => AuthContextSchema.parse(null)).not.toThrow();
  });

  it("accepts valid cookie payloads", () => {
    const ctx = {
      ricardo: { cookies: "ricardo_session=abc", expiresAt: new Date().toISOString() },
      tutti: { cookies: "tutti_session=xyz", expiresAt: new Date().toISOString() },
    };
    expect(() => AuthContextSchema.parse(ctx)).not.toThrow();
  });

  it("accepts storageState", () => {
    const ctx = {
      ricardo: null,
      tutti: { cookies: "x", storageState: '{"cookies":[]}', expiresAt: new Date().toISOString() },
    };
    expect(() => AuthContextSchema.parse(ctx)).not.toThrow();
  });

  it("rejects invalid", () => {
    expect(() => AuthContextSchema.parse({ ricardo: "bad" })).toThrow();
  });
});
