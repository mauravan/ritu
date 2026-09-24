import { NextResponse } from "next/server";
import { RicardoClient } from "ricardo-api";
import { TuttiClient } from "tutti-api";
import { extractListingImages } from "@/lib/listingImages";
import { logger } from "@/lib/logger";
import { withRetry, withRicardoLimit, withTuttiLimit } from "@/lib/marketplaces/rateLimit";
import { getProxyFetch } from "@/lib/proxyFetch";

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
        withRetry(() => new RicardoClient({ fetch: getProxyFetch() }).listings.get(id), "ricardo"),
      );
    } else {
      detail = await withTuttiLimit(() =>
        withRetry(() => new TuttiClient().listings.get(id), "tutti"),
      );
    }
    const images = extractListingImages(detail, marketplace);
    return NextResponse.json({ images });
  } catch (err) {
    logger.warn(`[RITU][IMAGES] fetch failed ${marketplace}:${id}`, err);
    return NextResponse.json({ error: "images_fetch_failed" }, { status: 502 });
  }
}
