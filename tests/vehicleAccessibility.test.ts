import assert from "node:assert/strict";
import test from "node:test";
import { hasWheelchairRamp } from "../app/data/vehicleAccessibility.ts";

test("identifica solamente los internos configurados con rampa", () => {
  assert.equal(hasWheelchairRamp("760"), true);
  assert.equal(hasWheelchairRamp(" 791 "), true);
  assert.equal(hasWheelchairRamp("759"), false);
  assert.equal(hasWheelchairRamp(undefined), false);
});
