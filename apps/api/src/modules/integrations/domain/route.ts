/**
 * Route estimation: a provisional straight-line estimate, extracted from
 * `syncvet-calcular-trajeto/index.ts:5-23`, `:64-79`.
 *
 * The estimate is deliberately not a route service: it is a linear distance
 * between two points, and it says so in its own response (`fonte`). A real route
 * service would replace this adapter without changing the contract.
 */

/** Earth radius in kilometers (`syncvet-calcular-trajeto/index.ts:14`). */
export const EARTH_RADIUS_KM = 6371;

/** Average speed assumed to turn distance into minutes (`index.ts:68-69`). */
export const ROUTE_ESTIMATE_AVERAGE_SPEED_KMH = 60;

/** Origin of the numbers: it is an estimate, not a computed route (`index.ts:76`). */
export const ROUTE_ESTIMATE_SOURCE = "haversine_estimativa";

/** Latitude range accepted by the boundary (`index.ts:6`, `:8`). */
export const LATITUDE_RANGE = { min: -90, max: 90 } as const;

/** Longitude range accepted by the boundary (`index.ts:7`, `:9`). */
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type RouteEstimate = {
  distancia_km: number;
  duracao_min: number;
  origem_endereco: null;
  destino_endereco: null;
  fonte: typeof ROUTE_ESTIMATE_SOURCE;
};

export type RouteEstimationResult =
  | {
      accepted: true;
      estimate: RouteEstimate;
    }
  | {
      accepted: false;
      reason: "coordenada_invalida";
    };

/** A point is usable only when both coordinates are finite and inside their range. */
export function isGeoPointInRange(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    point.latitude >= LATITUDE_RANGE.min &&
    point.latitude <= LATITUDE_RANGE.max &&
    Number.isFinite(point.longitude) &&
    point.longitude >= LONGITUDE_RANGE.min &&
    point.longitude <= LONGITUDE_RANGE.max
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometers (`syncvet-calcular-trajeto/index.ts:13-23`). */
export function haversineKm(
  origin: GeoPoint,
  destination: GeoPoint,
): number {
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLng = toRadians(destination.longitude - origin.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Estimate of a route: two decimal places for the distance, minutes rounded from
 * the distance itself, and no address on either end because nothing resolves an
 * address today (`syncvet-calcular-trajeto/index.ts:66-77`).
 */
export function estimateRoute(
  origin: GeoPoint,
  destination: GeoPoint,
): RouteEstimationResult {
  if (!isGeoPointInRange(origin) || !isGeoPointInRange(destination)) {
    return { accepted: false, reason: "coordenada_invalida" };
  }

  const distanceKm = haversineKm(origin, destination);

  return {
    accepted: true,
    estimate: {
      distancia_km: Math.round(distanceKm * 100) / 100,
      duracao_min: Math.round((distanceKm / ROUTE_ESTIMATE_AVERAGE_SPEED_KMH) * ROUTE_ESTIMATE_AVERAGE_SPEED_KMH),
      origem_endereco: null,
      destino_endereco: null,
      fonte: ROUTE_ESTIMATE_SOURCE,
    },
  };
}
