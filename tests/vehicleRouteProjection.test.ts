import assert from "node:assert/strict";
import test from "node:test";
import {
  angularDifferenceDegrees,
  evaluateVehicleForStop,
  projectVehicleOntoRoute,
  selectVehicleDirection
} from "../app/data/vehicleRouteProjection.ts";
import { buildCumulativeDistanceMeters, type RouteGeometry, type RouteGeometryBundle } from "../app/data/routeGeometry.ts";
import type { StopProjection } from "../app/data/stopProjections.ts";

const idaGeometry = geometry("ida", [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 0.01 },
  { latitude: 0, longitude: 0.02 }
]);
const vueltaGeometry = geometry("vuelta", [
  { latitude: 0.002, longitude: 0.02 },
  { latitude: 0.002, longitude: 0.01 },
  { latitude: 0.002, longitude: 0 }
]);
const bundle = bundleWith([idaGeometry, vueltaGeometry]);

test("vehiculo claramente sobre IDA", () => {
  const projection = projectVehicleOntoRoute(vehicle(0, 0.005, 90), bundle);
  assert.equal(projection?.direction, "ida");
  assert.ok(projection.distanceFromRouteMeters < 1);
});

test("vehiculo claramente sobre VUELTA", () => {
  const projection = projectVehicleOntoRoute(vehicle(0.002, 0.005, 270), bundle);
  assert.equal(projection?.direction, "vuelta");
  assert.ok(projection.distanceFromRouteMeters < 1);
});

test("ambas geometrias cercanas pero course resuelve IDA", () => {
  const closeBundle = parallelCloseBundle();
  const selection = selectVehicleDirection(vehicle(0.00004, 0.005, 90), closeBundle);
  assert.equal(selection.selected?.direction, "ida");
});

test("ambas geometrias cercanas pero course resuelve VUELTA", () => {
  const closeBundle = parallelCloseBundle();
  const selection = selectVehicleDirection(vehicle(0.00004, 0.005, 270), closeBundle);
  assert.equal(selection.selected?.direction, "vuelta");
});

test("ambas ambiguas sin course da no_prediction", () => {
  const selection = selectVehicleDirection(vehicle(0.00004, 0.005, null), parallelCloseBundle());
  assert.equal(selection.selected, null);
  assert.equal(selection.reason, "missing_course");
});

test("vehiculo a mas de 100m del recorrido da no_prediction", () => {
  const selection = selectVehicleDirection(vehicle(0.01, 0.005, 90), bundle);
  assert.equal(selection.selected, null);
  assert.equal(selection.reason, "vehicle_off_route");
});

test("approaching", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.005, 90),
    geometryBundle: bundle,
    stopProjection: stopProjection("ida", 1_500)
  });
  assert.equal(state.status, "approaching");
  assert.ok((state.distanceRemainingMeters ?? 0) > 80);
});

test("arriving antes de parada", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.0097, 90),
    geometryBundle: bundle,
    stopProjection: stopProjection("ida", idaGeometry.cumulativeDistanceMeters[1])
  });
  assert.equal(state.status, "arriving");
  assert.ok((state.distanceRemainingMeters ?? 0) > 0);
});

test("arriving justo despues de parada dentro de 40m", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.0102, 90),
    geometryBundle: bundle,
    stopProjection: stopProjection("ida", idaGeometry.cumulativeDistanceMeters[1])
  });
  assert.equal(state.status, "arriving");
  assert.equal(state.distanceRemainingMeters, 0);
});

test("passed", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.011, 90),
    geometryBundle: bundle,
    stopProjection: stopProjection("ida", idaGeometry.cumulativeDistanceMeters[1])
  });
  assert.equal(state.status, "passed");
  assert.equal(state.distanceRemainingMeters, null);
});

test("diferencia angular cruzando 0/360", () => {
  assert.equal(angularDifferenceDegrees(350, 10), 20);
});

test("stopEtaReady false da no_prediction", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.005, 90),
    geometryBundle: bundle,
    stopProjection: { ...stopProjection("ida", 1_500), stopEtaReady: false }
  });
  assert.equal(state.status, "no_prediction");
  assert.equal(state.reason, "stop_not_ready");
});

test("ausencia de una geometria no provoca excepcion", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(0, 0.005, 90),
    geometryBundle: bundleWith([idaGeometry]),
    stopProjection: stopProjection("vuelta", 1_000)
  });
  assert.equal(state.status, "no_prediction");
});

test("datos invalidos no provocan 500", () => {
  const state = evaluateVehicleForStop({
    vehicle: vehicle(Number.NaN, 0.005, 90),
    geometryBundle: bundle,
    stopProjection: stopProjection("ida", 1_000)
  });
  assert.equal(state.status, "no_prediction");
  assert.equal(state.reason, "invalid_vehicle_data");
});

function parallelCloseBundle() {
  return bundleWith([
    geometry("ida", [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.01 }
    ]),
    geometry("vuelta", [
      { latitude: 0.00008, longitude: 0.01 },
      { latitude: 0.00008, longitude: 0 }
    ])
  ]);
}

function geometry(direction: "ida" | "vuelta", coordinates: RouteGeometry["coordinates"]): RouteGeometry {
  const cumulativeDistanceMeters = buildCumulativeDistanceMeters(coordinates);
  return {
    lineId: "test",
    direction,
    coordinates,
    cumulativeDistanceMeters,
    totalDistanceMeters: cumulativeDistanceMeters.at(-1) ?? 0,
    sourceHash: "fixture",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function bundleWith(geometries: RouteGeometry[]): RouteGeometryBundle {
  return {
    lineId: "test",
    sourceHash: "fixture",
    geometries,
    diagnostics: [],
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function vehicle(latitude: number, longitude: number, course: number | null) {
  return {
    assignedLineId: "test",
    latitude,
    longitude,
    course,
    speedKmh: 0,
    fixTime: "2026-01-01T00:00:00.000Z"
  };
}

function stopProjection(direction: "ida" | "vuelta", stopMeasureMeters: number): StopProjection {
  return {
    stopId: "stop",
    lineId: "test",
    direction,
    stopMeasureMeters,
    distanceFromRouteMeters: 0,
    segmentIndex: 0,
    segmentCourse: direction === "ida" ? 90 : 270,
    projectedLatitude: 0,
    projectedLongitude: 0,
    projectionValid: true,
    stopEtaReady: true,
    diagnostics: [],
    calculatedAt: "2026-01-01T00:00:00.000Z"
  };
}
