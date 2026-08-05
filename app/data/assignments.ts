import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type VehicleAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
};

const assignmentsFile = join(process.cwd(), "app", "data", "vehicleAssignments.json");

export function readAssignments(): VehicleAssignment[] {
  if (!existsSync(assignmentsFile)) return [];

  try {
    const rows = JSON.parse(readFileSync(assignmentsFile, "utf8")) as VehicleAssignment[];
    return Array.isArray(rows) ? rows.filter(isAssignment) : [];
  } catch {
    return [];
  }
}

export function upsertAssignment(next: VehicleAssignment) {
  const assignments = readAssignments();
  const index = assignments.findIndex((assignment) => assignment.deviceId === next.deviceId);

  if (index >= 0) {
    assignments[index] = next;
  } else {
    assignments.push(next);
  }

  writeFileSync(assignmentsFile, `${JSON.stringify(assignments, null, 2)}\n`, "utf8");
  return next;
}

function isAssignment(value: VehicleAssignment) {
  return (
    Number.isFinite(Number(value.deviceId)) &&
    typeof value.internalNumber === "string" &&
    typeof value.label === "string" &&
    typeof value.assignedLineId === "string"
  );
}
