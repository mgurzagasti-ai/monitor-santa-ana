import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { createStopArrivalsHandler, type StopArrivalsDependencies } from "../app/api/public/stop-arrivals/route.ts";
import { buildCumulativeDistanceMeters, type RouteGeometry, type RouteGeometryBundle } from "../app/data/routeGeometry.ts";
import { buildLineProjectionReadiness, type StopProjection } from "../app/data/stopProjections.ts";
import { evaluateVehicleForStop } from "../app/data/vehicleRouteProjection.ts";
import { estimateEtaForVehicleStop } from "../app/data/etaEstimate.ts";

type LineStop = {
  id: string;
  lineId: string;
  name: string;
  latitude: number;
  longitude: number;
  direction: "ida" | "vuelta" | "ambos";
  order?: number;
};

const fixedNow = new Date("2026-09-03T12:00:00.000Z");
const fleetUpdatedAt = "2026-09-03T11:59:50.000Z";
const line = {
  id: "2-peron",
  number: "2",
  name: "Linea 2 x Peron",
  color: "#0B6E4F",
  mapId: "fixture",
  mapUrl: "https://example.com/map",
  kmlUrl: "https://example.com/kml"
};
const otherLine = { ...line, id: "3", number: "3", name: "Linea 3" };
const stop: LineStop = {
  id: "2-peron-a12d14c1",
  lineId: "2-peron",
  name: "Hospital de ninos",
  latitude: 0,
  longitude: 0.01,
  direction: "ida"
};
const otherLineStop: LineStop = { ...stop, id: "other-stop", lineId: "3" };
const geometryBundle = bundleWith([
  geometry("ida", [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
    { latitude: 0, longitude: 0.02 }
  ]),
  geometry("vuelta", [
    { latitude: 0.01, longitude: 0.02 },
    { latitude: 0.01, longitude: 0.01 },
    { latitude: 0.01, longitude: 0 }
  ])
]);

test("lineId faltante devuelve 400", async () => {
  const response = await requestWith(defaultDependencies(), "stopId=2-peron-a12d14c1");
  assert.equal(response.status, 400);
});

test("stopId faltante devuelve 400", async () => {
  const response = await requestWith(defaultDependencies(), "lineId=2-peron");
  assert.equal(response.status, 400);
});

test("linea inexistente devuelve 404", async () => {
  const response = await requestWith(defaultDependencies(), "lineId=nope&stopId=2-peron-a12d14c1");
  assert.equal(response.status, 404);
});

test("parada inexistente devuelve 404", async () => {
  const response = await requestWith(defaultDependencies(), "lineId=2-peron&stopId=nope");
  assert.equal(response.status, 404);
});

test("parada de otra linea devuelve 404", async () => {
  const response = await requestWith(defaultDependencies({ stops: [stop, otherLineStop] }), "lineId=2-peron&stopId=other-stop");
  assert.equal(response.status, 404);
});

test("geometria no cacheada devuelve 200 sin prediccion", async () => {
  const response = await requestWith(defaultDependencies({ geometry: null }), validQuery());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.etaAvailable, false);
  assert.deepEqual(body.arrivals, []);
});

test("stopEtaReady=false devuelve 200 sin prediccion", async () => {
  const response = await requestWith(defaultDependencies({ stopProjection: { ...readyStopProjection(), stopEtaReady: false } }), validQuery());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.etaAvailable, false);
  assert.deepEqual(body.arrivals, []);
});

test("0 vehiculos devuelve etaAvailable=false", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [] }), validQuery());
  const body = await response.json();
  assert.equal(body.etaAvailable, false);
  assert.deepEqual(body.arrivals, []);
});
test("fleet consultado con updatedAt valido devuelve exactamente fleet.updatedAt", async () => {
  const body = await (await requestWith(defaultDependencies({ vehicles: [] }), validQuery())).json();
  assert.equal(body.updatedAt, fleetUpdatedAt);
});

test("fleet.updatedAt invalido devuelve updatedAt null", async () => {
  const body = await (await requestWith(defaultDependencies({ vehicles: [], fleetUpdatedAtValue: "no-es-fecha" }), validQuery())).json();
  assert.equal(body.updatedAt, null);
});

test("approaching devuelve llegada publica minima", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery());
  const body = await response.json();
  assert.equal(body.etaAvailable, true);
  assert.equal(body.arrivals.length, 1);
  assert.equal(body.arrivals[0].internalNumber, "705");
  assert.equal(body.arrivals[0].direction, "ida");
  assert.equal(body.arrivals[0].status, "approaching");
  assert.equal(Number.isFinite(body.arrivals[0].etaMinutes), true);
  assert.equal(Number.isFinite(body.arrivals[0].distanceRemainingMeters), true);
});

test("arriving se incluye con eta 0", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [vehicle("706", 0, 0.0098, 90, 15)] }), validQuery());
  const body = await response.json();
  assert.equal(body.arrivals[0].status, "arriving");
  assert.equal(body.arrivals[0].etaMinutes, 0);
});

test("passed queda excluido", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [vehicle("707", 0, 0.011, 90, 15)] }), validQuery());
  const body = await response.json();
  assert.equal(body.etaAvailable, false);
  assert.deepEqual(body.arrivals, []);
});

test("no_prediction queda excluido", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [vehicle("708", Number.NaN, 0.005, 90, 15)] }), validQuery());
  const body = await response.json();
  assert.deepEqual(body.arrivals, []);
});

test("GPS stale queda excluido", async () => {
  const response = await requestWith(
    defaultDependencies({ vehicles: [vehicle("709", 0, 0.005, 90, 15, "2026-09-03T11:55:00.000Z")] }),
    validQuery()
  );
  const body = await response.json();
  assert.deepEqual(body.arrivals, []);
});

test("direccion ambigua queda excluida", async () => {
  const response = await requestWith(defaultDependencies({ geometry: closeGeometryBundle(), vehicles: [vehicle("710", 0.00004, 0.005, null, 15)] }), validQuery());
  const body = await response.json();
  assert.deepEqual(body.arrivals, []);
});

test("vehiculo fuera de ruta queda excluido", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [vehicle("711", 0.02, 0.005, 90, 15)] }), validQuery());
  const body = await response.json();
  assert.deepEqual(body.arrivals, []);
});

test("multiples vehiculos se devuelven y ordenan correctamente", async () => {
  const response = await requestWith(
    defaultDependencies({
      vehicles: [vehicle("far", 0, 0.001, 90, 15), vehicle("arriving", 0, 0.0098, 90, 15), vehicle("near", 0, 0.008, 90, 15)]
    }),
    validQuery()
  );
  const body = await response.json();
  assert.deepEqual(
    body.arrivals.map((arrival: { internalNumber: string }) => arrival.internalNumber),
    ["arriving", "near", "far"]
  );
});

test("filtra unicamente por assignedLineId", async () => {
  const response = await requestWith(
    defaultDependencies({
      vehicles: [
        { ...vehicle("wrong", 0, 0.005, 90, 15), assignedLineId: "3", line: "2" },
        vehicle("right", 0, 0.005, 90, 15)
      ]
    }),
    validQuery()
  );
  const body = await response.json();
  assert.deepEqual(
    body.arrivals.map((arrival: { internalNumber: string }) => arrival.internalNumber),
    ["right"]
  );
});

test("etaAvailable refleja presencia o ausencia de arrivals", async () => {
  const withEta = await (await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery())).json();
  const withoutEta = await (await requestWith(defaultDependencies({ vehicles: [] }), validQuery())).json();
  assert.equal(withEta.etaAvailable, true);
  assert.equal(withoutEta.etaAvailable, false);
});

test("no devuelve NaN ni Infinity", async () => {
  const body = await (await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery())).json();
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("NaN"), false);
  assert.equal(serialized.includes("Infinity"), false);
});

test("no expone campos privados ni diagnosticos internos", async () => {
  const body = await (await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery())).json();
  const serialized = JSON.stringify(body);
  for (const field of [
    "uniqueId",
    "deviceId",
    "gps",
    "battery",
    "satellites",
    "ignition",
    "power",
    "confidence",
    "reason",
    "source",
    "effectiveSpeedKmh",
    "etaMinutesRaw"
  ]) {
    assert.equal(serialized.includes(field), false, field);
  }
});

for (const privateField of [
  "uniqueId",
  "deviceId",
  "gps",
  "battery",
  "satellites",
  "ignition",
  "power",
  "confidence",
  "reason",
  "source",
  "effectiveSpeedKmh",
  "etaMinutesRaw"
]) {
  test(`no expone ${privateField}`, async () => {
    const body = await (await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery())).json();
    assert.equal(JSON.stringify(body).includes(privateField), false);
  });
}
test("no llama dependencias prohibidas directas de Traccar ni build KML", async () => {
  const body = await (await requestWith(defaultDependencies({ vehicles: [vehicle("705", 0, 0.005, 90, 15)] }), validQuery())).json();
  assert.equal(body.arrivals.length, 1);
});

test("el archivo del endpoint no importa getOrBuildRouteGeometryBundle ni Traccar/fetch KML", () => {
  const source = readFileSync("app/api/public/stop-arrivals/route.ts", "utf8");
  assert.equal(source.includes("getOrBuildRouteGeometryBundle"), false);
  assert.equal(source.includes("fetchPositions"), false);
  assert.equal(source.includes("kmlUrl"), false);
  assert.equal(source.includes("fetch("), false);
});

test("headers CDN en 200", async () => {
  const response = await requestWith(defaultDependencies({ vehicles: [] }), validQuery());
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("Vercel-CDN-Cache-Control"), "public, s-maxage=10, stale-while-revalidate=20");
});

test("429 no cacheable publicamente", async () => {
  const response = await requestWith(defaultDependencies({ rateAllowed: false }), validQuery());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vercel-CDN-Cache-Control"), null);
  assert.equal(response.headers.get("Retry-After"), "30");
});

test("error inesperado controlado", async () => {
  const response = await requestWith(defaultDependencies({ readLineStopsError: new Error("boom") }), validQuery());
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(body, { error: "Internal Server Error" });
  assert.equal(JSON.stringify(body).includes("boom"), false);
});

function validQuery() {
  return "lineId=2-peron&stopId=2-peron-a12d14c1";
}

async function requestWith(dependencies: StopArrivalsDependencies, query: string) {
  const handler = createStopArrivalsHandler(dependencies);
  return handler(new NextRequest(`https://example.com/api/public/stop-arrivals?${query}`));
}

function defaultDependencies({
  stops = [stop],
  vehicles = [vehicle("705", 0, 0.005, 90, 15)],
  geometry = geometryBundle,
  stopProjection,
  rateAllowed = true,
  readLineStopsError,
  fleetUpdatedAtValue = fleetUpdatedAt
}: {
  stops?: LineStop[];
  vehicles?: ReturnType<typeof vehicle>[];
  geometry?: RouteGeometryBundle | null;
  stopProjection?: StopProjection;
  rateAllowed?: boolean;
  readLineStopsError?: Error;
  fleetUpdatedAtValue?: string;
} = {}): StopArrivalsDependencies {
  return {
    lineRoutes: [line, otherLine],
    readLineStops: async () => {
      if (readLineStopsError) throw readLineStopsError;
      return stops;
    },
    getCachedRouteGeometryBundle: async () => geometry,
    getOrBuildLineProjectionReadiness: async (lineId, lineStops, bundle) => {
      const readiness = buildLineProjectionReadiness(lineId, lineStops, bundle);
      if (!stopProjection) return readiness;
      return { ...readiness, projections: readiness.projections.map((projection) => (projection.stopId === stopProjection.stopId ? stopProjection : projection)) };
    },
    getFleetSnapshot: async () => ({
      vehicles,
      updatedAt: fleetUpdatedAtValue,
      source: "cache"
    }),
    evaluateVehicleForStop,
    estimateEtaForVehicleStop,
    checkRateLimit: async () => ({
      allowed: rateAllowed,
      limit: 600,
      remaining: rateAllowed ? 599 : 0,
      retryAfterSeconds: 30
    }),
    now: () => fixedNow
  };
}

function closeGeometryBundle() {
  return bundleWith([
    geometry("ida", [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.01 },
      { latitude: 0, longitude: 0.02 }
    ]),
    geometry("vuelta", [
      { latitude: 0.00008, longitude: 0.02 },
      { latitude: 0.00008, longitude: 0.01 },
      { latitude: 0.00008, longitude: 0 }
    ])
  ]);
}
function readyStopProjection(): StopProjection {
  return buildLineProjectionReadiness("2-peron", [stop], geometryBundle).projections[0];
}

function vehicle(
  internalNumber: string,
  latitude: number,
  longitude: number,
  course: number | null,
  speedKmh: number,
  fixTime = "2026-09-03T11:59:00.000Z"
) {
  return {
    id: Number.parseInt(internalNumber, 10) || internalNumber.length,
    line: "2",
    label: `Colectivo ${internalNumber}`,
    color: "#0B6E4F",
    deviceId: Number.parseInt(internalNumber, 10) || internalNumber.length,
    internalNumber,
    assignedLineId: "2-peron",
    assignedLineName: "Linea 2 x Peron",
    latitude,
    longitude,
    speedKmh,
    course,
    fixTime,
    gps: {
      status: "GPS activo",
      valid: true,
      fresh: true,
      moving: true,
      motion: true,
      ignition: true,
      power: 12,
      battery: 90,
      satellites: 8,
      distance: 1,
      ageSeconds: 60
    }
  };
}

function geometry(direction: "ida" | "vuelta", coordinates: RouteGeometry["coordinates"]): RouteGeometry {
  const cumulativeDistanceMeters = buildCumulativeDistanceMeters(coordinates);
  return {
    lineId: "2-peron",
    direction,
    coordinates,
    cumulativeDistanceMeters,
    totalDistanceMeters: cumulativeDistanceMeters.at(-1) ?? 0,
    sourceHash: "fixture",
    updatedAt: "2026-09-03T00:00:00.000Z"
  };
}

function bundleWith(geometries: RouteGeometry[]): RouteGeometryBundle {
  return {
    lineId: "2-peron",
    sourceHash: "fixture",
    geometries,
    diagnostics: [],
    updatedAt: "2026-09-03T00:00:00.000Z"
  };
}
