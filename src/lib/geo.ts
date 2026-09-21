import { logger } from "./logger";
import { POSTCODES } from "./postcodes";
import type { RawProduct } from "./types";

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export function filterByDistance(
  products: RawProduct[],
  zipCode: string,
  radiusKm: number,
): RawProduct[] {
  const origin = POSTCODES[zipCode];
  if (!origin) {
    logger.warn(`[RITU][GEO] unknown PLZ "${zipCode}" — skipping distance filter`);
    return products;
  }
  return products.filter((p) => {
    const zip = p.zipCode?.trim();
    if (!zip) return false;
    const dest = POSTCODES[zip];
    if (!dest) return false;
    return haversineKm(origin[0], origin[1], dest[0], dest[1]) <= radiusKm;
  });
}
