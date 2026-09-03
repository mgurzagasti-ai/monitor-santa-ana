import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isRedisConfigured, redisCommand } from "./redis";

export type VehicleAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
  operationalStatus: OperationalStatus;
};

export const operationalStatuses = ["EN_SERVICIO", "FUERA_DE_SERVICIO", "TALLER"] as const;
export type OperationalStatus = (typeof operationalStatuses)[number];

const assignmentsFile = join(process.cwd(), "app", "data", "vehicleAssignments.json");
const assignmentsRedisKey = "vehicle_assignments";

export async function readAssignments(): Promise<VehicleAssignment[]> {
  const remoteAssignments = await readRedisAssignments();
  if (remoteAssignments) return remoteAssignments;
  return readLocalAssignments();
}

export async function upsertAssignment(next: VehicleAssignment) {
  const assignments = await readAssignments();
  const index = assignments.findIndex((assignment) => assignment.deviceId === next.deviceId);

  if (index >= 0) {
    assignments[index] = next;
  } else {
    assignments.push(next);
  }

  await writeRedisAssignments(assignments);
  writeLocalAssignments(assignments);
  return next;
}

function readLocalAssignments(): VehicleAssignment[] {
  if (!existsSync(assignmentsFile)) return [];

  try {
    const rows = JSON.parse(readFileSync(assignmentsFile, "utf8")) as Partial<VehicleAssignment>[];
    return Array.isArray(rows) ? rows.filter(isAssignment).map(normalizeAssignment) : [];
  } catch {
    return [];
  }
}

function writeLocalAssignments(assignments: VehicleAssignment[]) {
  try {
    writeFileSync(assignmentsFile, `${JSON.stringify(assignments, null, 2)}\n`, "utf8");
  } catch {
    // Vercel functions run on a read-only filesystem; Redis remains the source of truth there.
  }
}

async function readRedisAssignments(): Promise<VehicleAssignment[] | null> {
  if (!isRedisConfigured()) return null;

  const response = await redisCommand<string | null>(["GET", assignmentsRedisKey]);
  if (!response) return [];

  try {
    const rows = JSON.parse(response) as Partial<VehicleAssignment>[];
    return Array.isArray(rows) ? rows.filter(isAssignment).map(normalizeAssignment) : [];
  } catch {
    return [];
  }
}

async function writeRedisAssignments(assignments: VehicleAssignment[]) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", assignmentsRedisKey, JSON.stringify(assignments)]);
}

export function normalizeOperationalStatus(value: unknown): OperationalStatus {
  return operationalStatuses.includes(value as OperationalStatus)
    ? (value as OperationalStatus)
    : "EN_SERVICIO";
}

function normalizeAssignment(value: Partial<VehicleAssignment>): VehicleAssignment {
  return {
    deviceId: Number(value.deviceId),
    internalNumber: value.internalNumber ?? "",
    label: value.label ?? "",
    assignedLineId: value.assignedLineId ?? "",
    operationalStatus: normalizeOperationalStatus(value.operationalStatus)
  };
}

function isAssignment(value: Partial<VehicleAssignment>) {
  return (
    Number.isFinite(Number(value.deviceId)) &&
    typeof value.internalNumber === "string" &&
    typeof value.label === "string" &&
    typeof value.assignedLineId === "string"
  );
}
