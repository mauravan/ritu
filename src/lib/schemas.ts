import { z } from "zod";

export const DerivedSpecSchema = z
  .object({
    category: z.string().describe("canonical product noun, lowercase singular"),
    summary: z.string().describe("one sentence summary of user need"),
    requirements: z.array(
      z
        .object({
          key: z.string(),
          value: z.string(),
          importance: z.enum(["required", "preferred"]),
        })
        .describe("requirement entry"),
    ),
    searchQueries: z
      .array(z.string())
      .describe("2 short marketplace search terms, primary product only"),
    excludedTerms: z.array(z.string()).describe("accessory terms to exclude, 5-10 terms"),
  })
  .strict();

export const MarketplaceQuerySchema = z
  .object({
    marketplace: z.enum(["ricardo", "tutti"]),
    query: z.string(),
    url: z.string(),
  })
  .strict();

export const RawProductSchema = z
  .object({
    id: z.string(),
    marketplace: z.enum(["ricardo", "tutti"]),
    title: z.string(),
    priceChf: z.number().nullable(),
    currency: z.literal("CHF"),
    condition: z.string().nullable(),
    imageUrl: z.string().nullable(),
    url: z.string(),
    location: z.string().nullable(),
    zipCode: z.string().nullable().optional(),
    raw: z.unknown(),
  })
  .strict();

export const RankedProductSchema = RawProductSchema.extend({
  specScore: z.number(),
  valueScore: z.number(),
  tags: z.array(z.enum(["best value", "best specs", "cheapest", "best condition", "balanced"])),
  matchedRequirements: z.array(z.string()),
  reasons: z.array(z.string()),
}).strict();

export const SearchResultSchema = z
  .object({
    input: z.string(),
    derivedSpec: DerivedSpecSchema,
    queries: z.array(MarketplaceQuerySchema),
    products: z.array(RankedProductSchema),
    platform: z.enum(["both", "ricardo", "tutti"]).optional(),
    clarifyingQuestion: z.string().optional(),
    clarifyingAnswer: z.string().optional(),
    originalQuery: z.string().optional(),
  })
  .strict();

export const SearchRequestSchema = z.object({
  query: z.string().min(3).max(500),
  platform: z.enum(["both", "ricardo", "tutti"]).optional().default("both"),
  askQuestion: z.boolean().optional().default(false),
  clarifyingAnswer: z.string().optional(),
  clarifyingQuestion: z.string().optional(),
  originalQuery: z.string().optional(),
  derivedSpec: DerivedSpecSchema.optional(),
  zipCode: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  radius: z.number().positive().optional(),
});
