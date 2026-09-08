import assert from "node:assert/strict";
import test from "node:test";
import {
  recordVehicleRouteProgressSample,
  resetVehicleRouteProgressHistoryForTests
} from "../app/data/vehicleRouteProgressHistory.ts";

test("dos consultas consecutivas con mismo fixTime no destruyen anterior actual", async () => {
  resetVehicleRouteProgressHistoryForTests();
  const first = sample(1, 900, "2026-01-01T12:00:00.000Z");
  const second = sample(1, 1_200, "2026-01-01T12:00:30.000Z");
  const duplicate = sample(1, 1_300, "2026-01-01T12:00:30.000Z");

  await recordVehicleRouteProgressSample(first);
  const afterSecond = await recordVehicleRouteProgressSample(second);
  const afterDuplicate = await recordVehicleRouteProgressSample(duplicate);

  assert.equal(afterSecond?.previous?.vehicleMeasureMeters, 900);
  assert.equal(afterSecond?.current.vehicleMeasureMeters, 1_200);
  assert.equal(afterDuplicate?.previous?.vehicleMeasureMeters, 900);
  assert.equal(afterDuplicate?.current.vehicleMeasureMeters, 1_200);
});

function sample(deviceId: number, vehicleMeasureMeters: number, fixTime: string) {
  return {
    deviceId,
    lineId: "test",
    direction: "ida" as const,
    vehicleMeasureMeters,
    distanceFromRouteMeters: 0,
    fixTime,
    fixTimeMs: new Date(fixTime).getTime()
  };
}
