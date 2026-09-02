import assert from "node:assert/strict";
import test from "node:test";
import type { LineStop } from "../app/data/lineStops.ts";
import { buildLineProjectionReadiness } from "../app/data/stopProjections.ts";
import {
  buildCumulativeDistanceMeters,
  buildRouteGeometryBundleFromKml,
  inferRouteDirection,
  projectPointOntoRoute,
  type RouteGeometry
} from "../app/data/routeGeometry.ts";

const baseGeometry: RouteGeometry = {
  lineId: "test",
  direction: "ida",
  coordinates: [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
    { latitude: 0, longitude: 0.02 }
  ],
  cumulativeDistanceMeters: [],
  totalDistanceMeters: 0,
  sourceHash: "fixture",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
baseGeometry.cumulativeDistanceMeters = buildCumulativeDistanceMeters(baseGeometry.coordinates);
baseGeometry.totalDistanceMeters = baseGeometry.cumulativeDistanceMeters.at(-1) ?? 0;

test("distancia acumulada creciente", () => {
  assert.equal(baseGeometry.cumulativeDistanceMeters[0], 0);
  assert.ok(baseGeometry.cumulativeDistanceMeters[1] > baseGeometry.cumulativeDistanceMeters[0]);
  assert.ok(baseGeometry.cumulativeDistanceMeters[2] > baseGeometry.cumulativeDistanceMeters[1]);
  assert.equal(baseGeometry.totalDistanceMeters, baseGeometry.cumulativeDistanceMeters[2]);
});

test("proyeccion sobre segmento", () => {
  const projection = projectPointOntoRoute(0, 0.005, baseGeometry);
  assert.ok(projection);
  assert.equal(projection.segmentIndex, 0);
  assert.ok(projection.distanceFromRouteMeters < 1);
  assert.ok(projection.distanceAlongRouteMeters > 500);
});

test("proyeccion cerca de un extremo", () => {
  const projection = projectPointOntoRoute(0, 0.0001, baseGeometry);
  assert.ok(projection);
  assert.equal(projection.segmentIndex, 0);
  assert.ok(projection.distanceAlongRouteMeters < 20);
});

test("punto fuera del recorrido", () => {
  const projection = projectPointOntoRoute(0.01, 0.005, baseGeometry);
  assert.ok(projection);
  assert.ok(projection.distanceFromRouteMeters > 100);
});

test("identificacion IDA", () => {
  assert.equal(inferRouteDirection("  IDA LINEA 30 "), "ida");
});

test("identificacion VUELTA", () => {
  assert.equal(inferRouteDirection("vuelta linea 30 ramal"), "vuelta");
});

test("KML sin direccion reconocible", () => {
  const bundle = buildRouteGeometryBundleFromKml(
    "test",
    `<kml><Placemark><name>Recorrido principal</name><LineString><coordinates>0,0 0.01,0</coordinates></LineString></Placemark></kml>`
  );
  assert.equal(bundle.geometries.length, 0);
  assert.equal(bundle.diagnostics[0]?.code, "missing_direction");
});

test("stop dentro de 100m es valido", () => {
  const readiness = buildLineProjectionReadiness("test", [stop("a", "ida", 0, 0.005, 1)], {
    lineId: "test",
    sourceHash: "fixture",
    geometries: [baseGeometry, { ...baseGeometry, direction: "vuelta" }],
    diagnostics: [],
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(readiness.projections[0]?.projectionValid, true);
  assert.equal(readiness.projections[0]?.stopEtaReady, true);
});

test("stop a mas de 100m es invalido", () => {
  const readiness = buildLineProjectionReadiness("test", [stop("a", "ida", 0.01, 0.005, 1)], {
    lineId: "test",
    sourceHash: "fixture",
    geometries: [baseGeometry, { ...baseGeometry, direction: "vuelta" }],
    diagnostics: [],
    updatedAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(readiness.projections[0]?.projectionValid, false);
  assert.equal(readiness.projections[0]?.stopEtaReady, false);
});

test("order inconsistente detectado", () => {
  const readiness = buildLineProjectionReadiness(
    "test",
    [stop("second", "ida", 0, 0.015, 1), stop("first", "ida", 0, 0.005, 2)],
    {
      lineId: "test",
      sourceHash: "fixture",
      geometries: [baseGeometry, { ...baseGeometry, direction: "vuelta" }],
      diagnostics: [],
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  );
  assert.equal(readiness.orderDiagnostics.length, 1);
  assert.equal(readiness.orderDiagnostics[0]?.diagnostics[0]?.code, "order_inconsistent");
});

function stop(
  id: string,
  direction: LineStop["direction"],
  latitude: number,
  longitude: number,
  order?: number
): LineStop {
  return {
    id,
    lineId: "test",
    name: id,
    latitude,
    longitude,
    direction,
    order
  };
}
