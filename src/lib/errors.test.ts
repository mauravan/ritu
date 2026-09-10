import { describe, expect, it } from "vitest";
import { MarketplaceError, SpecDerivationError, ValidationError } from "./errors";

describe("errors contracts", () => {
  it("ValidationError propagates fields and raw", () => {
    const err = new ValidationError("bad", {
      fields: { a: ["x"] },
      raw: { b: 1 },
    });
    expect(err.code).toBe("validation_error");
    expect(err.fields).toEqual({ a: ["x"] });
    expect(err.raw).toEqual({ b: 1 });
  });

  it("SpecDerivationError has cause and code", () => {
    const cause = new Error("cause");
    const err = new SpecDerivationError("fail", cause);
    expect(err.code).toBe("spec_derivation_failed");
    expect(err.cause).toBe(cause);
  });

  it("MarketplaceError has code", () => {
    const err = new MarketplaceError("market error");
    expect(err.code).toBe("marketplace_error");
    expect(err.name).toBe("MarketplaceError");
  });
});
