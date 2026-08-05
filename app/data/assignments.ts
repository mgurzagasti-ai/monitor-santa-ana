import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type VehicleAssignment = {
  deviceId: number;
  internalNumber: string;
  label: string;
  assignedLineId: string;
};

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
    const rows = JSON.parse(readFileSync(assignmentsFile, "utf8")) as VehicleAssignment[];
    return Array.isArray(rows) ? rows.filter(isAssignment) : [];
  } catch {
    return [];
  }
}

function writeLocalAssignments(assignments: VehicleAssignment[]) {
  writeFileSync(assignmentsFile, `${JSON.stringify(assignments, null, 2)}\n`, "utf8");
}

async function readRedisAssignments(): Promise<VehicleAssignment[] | null> {
  if (!isRedisConfigured()) return null;

  const response = await redisCommand<string | null>(["GET", assignmentsRedisKey]);
  if (!response) return [];

  try {
    const rows = JSON.parse(response) as VehicleAssignment[];
    return Array.isArray(rows) ? rows.filter(isAssignment) : [];
  } catch {
    return [];
  }
}

async function writeRedisAssignments(assignments: VehicleAssignment[]) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", assignmentsRedisKey, JSON.stringify(assignments)]);
}

function isRedisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand<T>(command: string[]): Promise<T> {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });

  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok || body.error) {
    throw new Error(body.error ?? `Upstash HTTP ${response.status}`);
  }

  return body.result as T;
}

function isAssignment(value: VehicleAssignment) {
  return (
    Number.isFinite(Number(value.deviceId)) &&
    typeof value.internalNumber === "string" &&
    typeof value.label === "string" &&
    typeof value.assignedLineId === "string"
  );
}
