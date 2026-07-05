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
