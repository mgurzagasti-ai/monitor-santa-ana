import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultUrbanSpeedKmh,
  estimateEtaForVehicleStop,
  effectiveSpeedKmh,
  getPositionAgeSeconds,
  maxUsableSpeedKmh
} from "../app/data/etaEstimate.ts";
import type { VehicleStopState } from "../app/data/vehicleRouteProjection.ts";

const currentTime = "2026-01-01T12:02:00.000Z";
const recentFixTime = "2026-01-01T12:01:00.000Z";
const staleFixTime = "2026-01-01T11:59:00.000Z";

test("approaching con velocidad 15 km/h y distancia conocida", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_500), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, 6);
  assert.equal(eta.effectiveSpeedKmh, 15);
  assert.equal(eta.confidence, "current_speed");
});

test("approaching con velocidad valida distinta de default", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_500), vehicle(30, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, 3);
  assert.equal(eta.effectiveSpeedKmh, 30);
});

test("velocidad 0 usa default 15", () => {
  const speed = effectiveSpeedKmh(0);
  assert.equal(speed.effectiveSpeedKmh, defaultUrbanSpeedKmh);
  assert.equal(speed.confidence, "default_speed");
});

test("velocidad menor a 5 usa default", () => {
  assert.equal(effectiveSpeedKmh(4.9).effectiveSpeedKmh, defaultUrbanSpeedKmh);
});

test("speed null usa default", () => {
  assert.equal(effectiveSpeedKmh(null).effectiveSpeedKmh, defaultUrbanSpeedKmh);
});

test("NaN usa default", () => {
  assert.equal(effectiveSpeedKmh(Number.NaN).effectiveSpeedKmh, defaultUrbanSpeedKmh);
});

test("Infinity usa default", () => {
  assert.equal(effectiveSpeedKmh(Number.POSITIVE_INFINITY).effectiveSpeedKmh, defaultUrbanSpeedKmh);
});

test("velocidad mayor a 60 se limita a maximo seguro", () => {
  const speed = effectiveSpeedKmh(80);
  assert.equal(speed.effectiveSpeedKmh, maxUsableSpeedKmh);
  assert.equal(speed.confidence, "current_speed");
});

test("arriving devuelve eta 0", () => {
  const eta = estimateEtaForVehicleStop(state("arriving", 0), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, 0);
  assert.equal(eta.etaMinutesRaw, 0);
  assert.equal(eta.confidence, "arriving");
});

test("passed devuelve eta null", () => {
  const eta = estimateEtaForVehicleStop(state("passed", null), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.confidence, "not_available");
});

test("no_prediction devuelve eta null", () => {
  const eta = estimateEtaForVehicleStop(state("no_prediction", null), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.confidence, "not_available");
});

test("distanceRemaining negativa devuelve not_available", () => {
  const eta = estimateEtaForVehicleStop(approaching(-1), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.reason, "invalid_distance");
});

test("distanceRemaining NaN devuelve not_available", () => {
  const eta = estimateEtaForVehicleStop(approaching(Number.NaN), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.reason, "invalid_distance");
});

test("distanceRemaining Infinity devuelve not_available", () => {
  const eta = estimateEtaForVehicleStop(approaching(Number.POSITIVE_INFINITY), vehicle(15, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.reason, "invalid_distance");
});

test("posicion reciente permite ETA", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_000), vehicle(15, recentFixTime), { currentTime });
  assert.notEqual(eta.etaMinutes, null);
});

test("posicion mayor a 120 segundos devuelve stale_position", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_000), vehicle(15, staleFixTime), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.reason, "stale_position");
});

test("fixTime invalido devuelve ETA null", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_000), vehicle(15, "no-es-fecha"), { currentTime });
  assert.equal(eta.etaMinutes, null);
  assert.equal(eta.reason, "invalid_fix_time");
});

test("redondeo usa ceil", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_001), vehicle(60, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, 2);
});

test("ETA approaching menor a 1 minuto devuelve minimo 1", () => {
  const eta = estimateEtaForVehicleStop(approaching(10), vehicle(60, recentFixTime), { currentTime });
  assert.equal(eta.etaMinutes, 1);
});

test("calculo no genera Infinity ni NaN", () => {
  const eta = estimateEtaForVehicleStop(approaching(1_500), vehicle(15, recentFixTime), { currentTime });
  assert.equal(Number.isFinite(eta.etaMinutesRaw), true);
  assert.equal(Number.isFinite(eta.effectiveSpeedKmh), true);
});

test("la funcion usa currentTime explicito para edad de posicion", () => {
  assert.equal(getPositionAgeSeconds(recentFixTime, currentTime), 60);
});

function vehicle(speedKmh: number | null, fixTime: string | null) {
  return { speedKmh, fixTime };
}

function approaching(distanceRemainingMeters: number): VehicleStopState {
  return state("approaching", distanceRemainingMeters);
}

function state(status: VehicleStopState["status"], distanceRemainingMeters: number | null): VehicleStopState {
  return {
    status,
    direction: status === "no_prediction" ? null : "ida",
    vehicleMeasureMeters: status === "no_prediction" ? null : 0,
    stopMeasureMeters: 1_500,
    distanceRemainingMeters,
    distanceFromRouteMeters: status === "no_prediction" ? null : 0
  };
}
