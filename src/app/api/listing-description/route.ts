import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { RicardoClient } from "ricardo-api";
import { TuttiClient } from "tutti-api";
import { extractListingDescription, formatListingDescription } from "@/lib/listingDescription";
import { withRetry, withRicardoLimit, withTuttiLimit } from "@/lib/marketplaces/rateLimit";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const marketplace = url.searchParams.get("marketplace");
  const id = url.searchParams.get("id");
  if ((marketplace !== "ricardo" && marketplace !== "tutti") || !id || id.length > 100) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  try {
    let detail: unknown;
    if (marketplace === "ricardo") {
      detail = await withRicardoLimit(() =>
        withRetry(() => new RicardoClient().listings.get(id), "ricardo"),
      );
    } else {
      detail = await withTuttiLimit(() =>
        withRetry(() => new TuttiClient().listings.get(id), "tutti"),
      );
    }
    const rawText = extractListingDescription(detail, marketplace);
    const description = rawText === null ? null : formatListingDescription(rawText);
    return NextResponse.json({ description });
  } catch (err) {
    logger.warn(`[RITU][DESC] fetch failed ${marketplace}:${id}`, err);
    return NextResponse.json({ error: "description_fetch_failed" }, { status: 502 });
  }
}
