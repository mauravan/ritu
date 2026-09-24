import { normalizeImageUrl } from "./marketplaces/tuttiApi";

export function extractListingImages(detail: unknown, marketplace: "ricardo" | "tutti"): string[] {
  if (typeof detail !== "object" || detail === null) return [];
  const images = (detail as Record<string, unknown>).images;
  if (!Array.isArray(images)) return [];
  const urls: string[] = [];
  if (marketplace === "ricardo") {
    for (const img of images) {
      if (typeof img !== "object" || img === null) continue;
      const transformations = (img as Record<string, unknown>).transformations;
      if (!Array.isArray(transformations)) continue;
      let bestUrl: string | null = null;
      let bestArea = -1;
      let lastUrl: string | null = null;
      for (const t of transformations) {
        if (typeof t !== "object" || t === null) continue;
        const rec = t as Record<string, unknown>;
        const url = typeof rec.url === "string" && rec.url.length > 0 ? rec.url : null;
        if (url === null) continue;
        lastUrl = url;
        const name = typeof rec.name === "string" ? rec.name : "";
        const m = /^t_(\d+)x(\d+)$/.exec(name);
        if (m) {
          const area = Number(m[1]) * Number(m[2]);
          if (area > bestArea) {
            bestArea = area;
            bestUrl = url;
          }
        }
      }
      const picked = bestUrl ?? lastUrl;
      if (picked !== null) urls.push(picked);
    }
  } else {
    for (const img of images) {
      if (typeof img !== "object" || img === null) continue;
      const rendition = (img as Record<string, unknown>).rendition;
      const src =
        typeof rendition === "object" && rendition !== null
          ? (rendition as Record<string, unknown>).src
          : undefined;
      const normalized = normalizeImageUrl(src as string | null | undefined);
      if (normalized !== null) urls.push(normalized);
    }
  }
  return [...new Set(urls)];
}
