/**
 * utils/geometry.ts
 *
 * Lightweight 2D geometry helpers for polygon boundary validation and point-in-polygon checking.
 * Zero external dependencies.
 */

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

export interface XYPoint {
  x: number;
  y: number;
}

export type GeoPoint = LatLngPoint | XYPoint | { latitude?: number; longitude?: number; x?: number; y?: number };

/**
 * Normalises a GeoPoint to [x, y] coordinates.
 * Supports { latitude, longitude } and { x, y }.
 */
export function toCoordTuple(pt: GeoPoint): [number, number] {
  if ('latitude' in pt && pt.latitude !== undefined && 'longitude' in pt && pt.longitude !== undefined) {
    return [pt.longitude, pt.latitude]; // [x=lng, y=lat]
  }
  if ('x' in pt && pt.x !== undefined && 'y' in pt && pt.y !== undefined) {
    return [pt.x, pt.y];
  }
  return [0, 0];
}

/**
 * Computes the 2D cross product of vector AB and AC.
 */
function crossProduct(
  a: [number, number],
  b: [number, number],
  c: [number, number]
): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * Checks if two line segments (p1, p2) and (p3, p4) strictly intersect.
 */
function doSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const cp1 = crossProduct(p1, p2, p3);
  const cp2 = crossProduct(p1, p2, p4);
  const cp3 = crossProduct(p3, p4, p1);
  const cp4 = crossProduct(p3, p4, p2);

  // Strict intersection test
  if (
    ((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
    ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether a polygon is simple (non-self-intersecting) and has >= 3 vertices.
 */
export function isValidSimplePolygon(vertices: GeoPoint[]): { valid: boolean; reason?: string } {
  if (!vertices || vertices.length < 3) {
    return { valid: false, reason: 'Boundary polygon must have at least 3 vertices.' };
  }

  const coords = vertices.map(toCoordTuple);
  const n = coords.length;

  // Check for duplicate consecutive vertices
  for (let i = 0; i < n; i++) {
    const current = coords[i];
    const next = coords[(i + 1) % n];
    if (current[0] === next[0] && current[1] === next[1]) {
      return { valid: false, reason: 'Polygon cannot have duplicate consecutive vertices.' };
    }
  }

  // Check all non-adjacent edge pairs for self-intersection
  for (let i = 0; i < n; i++) {
    const a = coords[i];
    const b = coords[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges and the wrap-around closing edge
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) {
        continue;
      }

      const c = coords[j];
      const d = coords[(j + 1) % n];

      if (doSegmentsIntersect(a, b, c, d)) {
        return { valid: false, reason: 'Polygon boundary is self-intersecting.' };
      }
    }
  }

  return { valid: true };
}

/**
 * Ray-casting algorithm to test if a point is inside a polygon.
 * Returns true if inside or on edge.
 */
export function isPointInsidePolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const pt = toCoordTuple(point);
  const poly = polygon.map(toCoordTuple);
  const n = poly.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];

    const intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculates geodesic distance between two coordinates in meters (Haversine formula).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates velocity in km/h given distance in meters and time delta in seconds.
 */
export function calculateVelocityKmh(
  distanceMeters: number,
  timeDeltaSeconds: number
): number {
  if (timeDeltaSeconds <= 0) return Infinity;
  const distanceKm = distanceMeters / 1000;
  const timeHours = timeDeltaSeconds / 3600;
  return distanceKm / timeHours;
}
