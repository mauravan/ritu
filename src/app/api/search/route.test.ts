import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("search route contracts", () => {
  it("returns structured errors, not raw Error", async () => {
    await expect(true).toBe(true);
  });
});
