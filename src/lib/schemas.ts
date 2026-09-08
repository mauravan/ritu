import { z } from "zod";

export const DerivedSpecSchema = z
  .object({
    category: z.string(),
    summary: z.string(),
    requirements: z.array(
      z
        .object({
          key: z.string(),
          value: z.string(),
          importance: z.enum(["required", "preferred"]),
        })
        .strict(),
    ),
    searchQueries: z.array(z.string()),
    excludedTerms: z.array(z.string()),
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
    authUsed: z.object({ ricardo: z.boolean(), tutti: z.boolean() }).strict(),
  })
  .strict();

export const AuthContextSchema = z
  .union([
    z.null(),
    z
      .object({
        ricardo: z
          .union([
            z.null(),
            z
              .object({
                cookies: z.string(),
                expiresAt: z.string(),
              })
              .strict(),
          ])
          .nullable(),
        tutti: z
          .union([
            z.null(),
            z
              .object({
                cookies: z.string(),
                storageState: z.string().optional(),
                expiresAt: z.string(),
              })
              .strict(),
          ])
          .nullable(),
      })
      .strict(),
  ])
  .nullable();

export const SearchRequestSchema = z.object({
  query: z.string().min(3).max(500),
});

export const AuthSessionRequestSchema = z.object({
  marketplace: z.enum(["ricardo", "tutti"]),
  cookieString: z.string().min(1),
});

export const AuthLogoutRequestSchema = z.object({
  marketplace: z.enum(["ricardo", "tutti"]),
});
