// Distances for attendance geofencing (the same formula as the server's).

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** "340 m" / "1.2 km". */
export const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Whether a position counts as inside a perimeter, allowing for its reported
 * GPS accuracy up to [toleranceMax] metres. The server decides; this mirrors it
 * so the page can explain before submitting.
 */
export function insidePerimeter(distance: number, radius: number, accuracy: number | null | undefined, toleranceMax = 50): boolean {
  return distance - Math.min(accuracy ?? 0, toleranceMax) <= radius;
}
