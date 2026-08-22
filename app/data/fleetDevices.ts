import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isRedisConfigured, redisCommand } from "./redis";

export type FleetDevice = {
  id: number;
  uniqueId?: string;
  line: string;
  label: string;
  color: string;
};

const fleetDevicesFile = join(process.cwd(), "app", "data", "fleetDevices.json");
const fleetDevicesRedisKey = "fleet_devices";

export function readEnvFleetDevices(value: string | undefined, fallbackId: number): FleetDevice[] {
  const fallbackDevices = fallbackId
    ? [
        {
          id: fallbackId,
          line: "49 BIS",
          label: "Santa Ana 49 BIS",
          color: "#f57c00"
        }
      ]
    : [];

  if (!value) return fallbackDevices;

  try {
    const devices = JSON.parse(value) as FleetDevice[];
    return Array.isArray(devices) && devices.length > 0 ? devices.filter(isFleetDevice) : fallbackDevices;
  } catch {
    return fallbackDevices;
  }
}

export async function readFleetDevices(baseDevices: FleetDevice[] = []): Promise<FleetDevice[]> {
  const remoteDevices = await readRedisFleetDevices();
  const localDevices = remoteDevices ?? readLocalFleetDevices();
  return mergeFleetDevices(baseDevices, localDevices);
}

export async function upsertFleetDevice(next: FleetDevice, baseDevices: FleetDevice[] = []) {
  const devices = await readFleetDevices(baseDevices);
  const index = devices.findIndex((device) => device.id === next.id);

  if (index >= 0) {
    devices[index] = { ...devices[index], ...next };
  } else {
    devices.push(next);
  }

  await writeRedisFleetDevices(devices);
  writeLocalFleetDevices(devices);
  return next;
}

function mergeFleetDevices(baseDevices: FleetDevice[], savedDevices: FleetDevice[]) {
  const devices = new Map<number, FleetDevice>();
  for (const device of baseDevices) devices.set(device.id, device);
  for (const device of savedDevices) devices.set(device.id, { ...devices.get(device.id), ...device });
  return Array.from(devices.values());
}

function readLocalFleetDevices(): FleetDevice[] {
  if (!existsSync(fleetDevicesFile)) return [];

  try {
    const rows = JSON.parse(readFileSync(fleetDevicesFile, "utf8")) as FleetDevice[];
    return Array.isArray(rows) ? rows.filter(isFleetDevice) : [];
  } catch {
    return [];
  }
}

function writeLocalFleetDevices(devices: FleetDevice[]) {
  try {
    writeFileSync(fleetDevicesFile, `${JSON.stringify(devices, null, 2)}\n`, "utf8");
  } catch {
    // Vercel functions run on a read-only filesystem; Redis remains the source of truth there.
  }
}

async function readRedisFleetDevices(): Promise<FleetDevice[] | null> {
  if (!isRedisConfigured()) return null;

  const response = await redisCommand<string | null>(["GET", fleetDevicesRedisKey]);
  if (!response) return null;

  try {
    const rows = JSON.parse(response) as FleetDevice[];
    return Array.isArray(rows) ? rows.filter(isFleetDevice) : [];
  } catch {
    return [];
  }
}

async function writeRedisFleetDevices(devices: FleetDevice[]) {
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", fleetDevicesRedisKey, JSON.stringify(devices)]);
}

function isFleetDevice(value: FleetDevice) {
  return (
    Number.isFinite(Number(value.id)) &&
    typeof value.line === "string" &&
    typeof value.label === "string" &&
    typeof value.color === "string"
  );
}
