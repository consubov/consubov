import { describe, expect, test } from "bun:test";
import {
  EARTH_RADIUS_KM,
  ROUTE_ESTIMATE_AVERAGE_SPEED_KMH,
  ROUTE_ESTIMATE_SOURCE,
  estimateRoute,
  haversineKm,
  isGeoPointInRange,
} from "./index";

describe("coordinate range", () => {
  test("accepts the boundaries and the interior", () => {
    expect(isGeoPointInRange({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isGeoPointInRange({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isGeoPointInRange({ latitude: 90, longitude: 180 })).toBe(true);
  });

  test("refuses a latitude or longitude outside its range", () => {
    expect(isGeoPointInRange({ latitude: 90.1, longitude: 0 })).toBe(false);
    expect(isGeoPointInRange({ latitude: -90.1, longitude: 0 })).toBe(false);
    expect(isGeoPointInRange({ latitude: 0, longitude: 180.1 })).toBe(false);
    expect(isGeoPointInRange({ latitude: 0, longitude: -180.1 })).toBe(false);
  });

  test("refuses a coordinate that is not a finite number", () => {
    expect(isGeoPointInRange({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isGeoPointInRange({ latitude: 0, longitude: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
  });
});

describe("route estimation", () => {
  test("computes the straight-line distance between two known points", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }))
      .toBeCloseTo(111.19, 2);
    expect(
      haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }),
    ).toBe(0);
    expect(EARTH_RADIUS_KM).toBe(6371);
  });

  test("answers with two decimal places, minutes and the estimate source", () => {
    const result = estimateRoute(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    expect(result.estimate.distancia_km).toBe(111.19);
    expect(result.estimate.duracao_min).toBe(111);
    expect(result.estimate.origem_endereco).toBeNull();
    expect(result.estimate.destino_endereco).toBeNull();
    expect(result.estimate.fonte).toBe(ROUTE_ESTIMATE_SOURCE);
    expect(ROUTE_ESTIMATE_SOURCE).toBe("haversine_estimativa");
  });

  test("derives the minutes from the distance at the proven average speed", () => {
    const origin = { latitude: -15.793889, longitude: -47.882778 };
    const destination = { latitude: -15.693889, longitude: -47.792778 };
    const result = estimateRoute(origin, destination);

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const distance = haversineKm(origin, destination);
    expect(result.estimate.distancia_km).toBe(Math.round(distance * 100) / 100);
    expect(result.estimate.duracao_min).toBe(
      Math.round((distance / ROUTE_ESTIMATE_AVERAGE_SPEED_KMH) * ROUTE_ESTIMATE_AVERAGE_SPEED_KMH),
    );
  });

  test("answers zero distance and zero minutes for the same point", () => {
    const point = { latitude: -20.5, longitude: -45.3 };
    const result = estimateRoute(point, point);

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    expect(result.estimate.distancia_km).toBe(0);
    expect(result.estimate.duracao_min).toBe(0);
  });

  test("refuses an origin or destination outside the ranges", () => {
    expect(estimateRoute({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toEqual({
      accepted: false,
      reason: "coordenada_invalida",
    });
    expect(estimateRoute({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: -181 })).toEqual({
      accepted: false,
      reason: "coordenada_invalida",
    });
  });
});
