// Distances for attendance geofencing (same formula as the server's).

/** Great-circle distance in metres (Haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** "340 m" / "1.2 km" */
export const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * Whether a device position counts as inside a perimeter, allowing for its
 * reported GPS accuracy up to `toleranceMax` metres (the server decides; this
 * mirrors it so the page can explain before submitting).
 */
export function insidePerimeter(distance: number, radius: number, accuracy: number | null | undefined, toleranceMax = 50) {
  return distance - Math.min(accuracy ?? 0, toleranceMax) <= radius;
}
