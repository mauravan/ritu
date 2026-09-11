import { describe, expect, it } from "vitest";
import { z } from "zod";
import { expectSchema } from "./contracts";

describe("contracts", () => {
  const testSchema = z.object({
    name: z.string(),
    age: z.number().int().positive(),
    email: z.string().email(),
  });

  it("returns parsed data for valid object", () => {
    const obj = { name: "John", age: 30, email: "john@example.com" };
    const result = expectSchema(obj, testSchema);
    expect(result).toEqual(obj);
  });

  it("throws for missing required field", () => {
    const obj = { name: "John", age: 30 };
    expect(() => expectSchema(obj, testSchema)).toThrow(
      "Contract assertion failed: expected schema match"
    );
  });

  it("throws for invalid email format", () => {
    const obj = { name: "John", age: 30, email: "invalid-email" };
    expect(() => expectSchema(obj, testSchema)).toThrow(
      "Contract assertion failed: expected schema match"
    );
  });

  it("throws for invalid age type", () => {
    const obj = { name: "John", age: "thirty", email: "john@example.com" };
    expect(() => expectSchema(obj, testSchema)).toThrow(
      "Contract assertion failed: expected schema match"
    );
  });

  it("throws for negative age", () => {
    const obj = { name: "John", age: -5, email: "john@example.com" };
    expect(() => expectSchema(obj, testSchema)).toThrow(
      "Contract assertion failed: expected schema match"
    );
  });

  it("includes error details in thrown message", () => {
    const obj = { name: "John", age: -5, email: "invalid" };
    try {
      expectSchema(obj, testSchema);
    } catch (e) {
      const error = e as Error;
      expect(error.message).toContain("Contract assertion failed");
      expect(error.message).toContain("Errors:");
      expect(error.message).toContain("Received:");
    }
  });

  it("handles array schemas", () => {
    const arraySchema = z.array(z.number());
    const result = expectSchema([1, 2, 3], arraySchema);
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws for invalid array items", () => {
    const arraySchema = z.array(z.number());
    expect(() => expectSchema([1, "two", 3], arraySchema)).toThrow(
      "Contract assertion failed"
    );
  });
});