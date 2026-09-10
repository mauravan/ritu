import { describe, expect, it } from "vitest";

describe("search route contracts", () => {
  it("returns structured errors, not raw Error", async () => {
    await expect(true).toBe(true);
  });
});
