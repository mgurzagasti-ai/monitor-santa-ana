import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAssignment } from "../app/data/assignmentReconciliation.ts";
import { compareInternalNumbers } from "../app/data/vehicleListSort.ts";

type TestAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
  operationalStatus: "EN_SERVICIO";
};

function assignment(deviceId: number, internalNumber: string): TestAssignment {
  return {
    deviceId,
    internalNumber,
    label: `Colectivo ${internalNumber}`,
    assignedLineId: "linea-1",
    operationalStatus: "EN_SERVICIO"
  };
}

test("reemplaza el GPS anterior de un interno sin dejar duplicados", () => {
  const result = reconcileAssignment(
    [assignment(10, "268"), assignment(20, "275")],
    assignment(57, "268")
  );

  assert.deepEqual(result, [assignment(57, "268"), assignment(20, "275")]);
});

test("reemplaza tambien la asociacion anterior del GPS nuevo", () => {
  const result = reconcileAssignment(
    [assignment(10, "268"), assignment(57, "300"), assignment(20, "275")],
    assignment(57, "268")
  );

  assert.deepEqual(result, [assignment(57, "268"), assignment(20, "275")]);
});

test("ordena internos numericamente y deja valores invalidos al final", () => {
  const rows = ["100", "sin interno", "99", "218", ""].map((internalNumber) => ({ internalNumber }));

  rows.sort(compareInternalNumbers);

  assert.deepEqual(rows.map((row) => row.internalNumber), ["99", "100", "218", "", "sin interno"]);
});
