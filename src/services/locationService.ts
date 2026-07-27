/**
 * Calculate Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Approximate degree-to-km conversion at the equator.
 * Used to convert a radial search radius into a lat/lng bounding box,
 * which lets the database pre-filter the working set before the precise
 * (circular) haversine distance is computed in memory.
 */
const KM_PER_DEG_LAT = 111.32;

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Compute a square bounding box around (lat, lng) that fully contains the
 * circle of the given radius. The box over-selects (corners) on purpose;
 * the precise circular filter is applied afterwards by `filterByProximity`.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const radLat = toRad(lat);
  const cosLat = Math.cos(radLat);
  // Guard against divide-by-zero near the poles (irrelevant for this app's
  // operating area, but keeps the math safe).
  const dLng = cosLat !== 0 ? radiusKm / (KM_PER_DEG_LAT * cosLat) : 180;

  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

/**
 * Given an array of objects with storeLat/storeLng, compute distance from
 * the reference point and optionally filter by radius.
 * Returns a new array with a `distanceKm` field appended.
 * Items with null coordinates are excluded.
 */
export function filterByProximity<
  T extends { storeLat: number | null; storeLng: number | null }
>(
  products: T[],
  lat: number,
  lng: number,
  radiusKm?: number
): Array<T & { distanceKm: number }> {
  const withDistance = products
    .map((p) => {
      if (p.storeLat == null || p.storeLng == null) return null;
      const distanceKm = haversineDistance(lat, lng, p.storeLat, p.storeLng);
      return { ...p, distanceKm };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (radiusKm !== undefined) {
    return withDistance.filter((p) => p.distanceKm <= radiusKm);
  }

  return withDistance;
}
