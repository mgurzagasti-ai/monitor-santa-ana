import assert from "node:assert/strict";
import test from "node:test";
import { validateAssignmentOperatorPassword } from "../app/data/assignmentOperatorPassword.ts";

test("rechaza la validacion si la variable no esta configurada", () => {
  const previous = process.env.ASSIGNMENT_OPERATOR_PASSWORD;
  delete process.env.ASSIGNMENT_OPERATOR_PASSWORD;

  try {
    assert.equal(validateAssignmentOperatorPassword("cualquier-valor"), "not_configured");
  } finally {
    restorePassword(previous);
  }
});

test("acepta solamente la contrasena configurada en el servidor", () => {
  const previous = process.env.ASSIGNMENT_OPERATOR_PASSWORD;
  process.env.ASSIGNMENT_OPERATOR_PASSWORD = "contrasena-de-prueba";

  try {
    assert.equal(validateAssignmentOperatorPassword("incorrecta"), "invalid");
    assert.equal(validateAssignmentOperatorPassword("contrasena-de-prueba"), "valid");
  } finally {
    restorePassword(previous);
  }
});

function restorePassword(previous: string | undefined) {
  if (previous === undefined) {
    delete process.env.ASSIGNMENT_OPERATOR_PASSWORD;
  } else {
    process.env.ASSIGNMENT_OPERATOR_PASSWORD = previous;
  }
}
