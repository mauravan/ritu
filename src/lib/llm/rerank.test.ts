import { describe, expect, it } from "vitest";
import { RerankSchema } from "./rerank";
import { expectSchema } from "../../test/utils/contracts";

describe("rerank contracts", () => {
  it("validates rerank output shape", () => {
    const result = expectSchema(
      {
        results: [
          { id: "p1", relevance: 85, relevant: true, reason: "strong" },
        ],
      },
      RerankSchema,
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.relevance).toBe(85);
  });
});
