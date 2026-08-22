import { readAssignments } from "@/app/data/assignments";
import { readFleetDevices } from "@/app/data/fleetDevices";
import { lineRoutes } from "@/app/data/lineRoutes";
import { isRedisConfigured, redisCommand } from "@/app/data/redis";
import { fetchPositions, getConfig, type TraccarPosition } from "@/app/api/traccar";

export type FleetVehicle = {
  id: number;
  line: string;
  label: string;
  color: string;
  deviceId: number;
  internalNumber: string;
  assignedLineId: string;
  assignedLineName: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number | null;
  fixTime: string;
  gps: ReturnType<typeof gpsDiagnostics>;
};

export type FleetSnapshot = {
  vehicles: FleetVehicle[];
  updatedAt: string;
  source: "fresh" | "cache";
};

const fleetCacheKey = "fleet_snapshot_v1";
const fleetCacheTtlSeconds = Number(process.env.FLEET_CACHE_TTL_SECONDS ?? 20);
let memoryCache: { expiresAt: number; snapshot: FleetSnapshot } | null = null;

export async function getFleetSnapshot(options: { forceFresh?: boolean } = {}): Promise<FleetSnapshot> {
  if (!options.forceFresh) {
    const cached = await readCachedFleetSnapshot();
    if (cached) return { ...cached, source: "cache" };
  }

  const snapshot = await buildFleetSnapshot();
  await writeCachedFleetSnapshot(snapshot);
  return snapshot;
}

export async function invalidateFleetCache() {
  memoryCache = null;
  if (!isRedisConfigured()) return;
  try {
    await redisCommand(["DEL", fleetCacheKey]);
  } catch {
    // Cache invalidation should never block an operator assignment change.
  }
}

async function buildFleetSnapshot(): Promise<FleetSnapshot> {
  const config = getConfig();
  const assignments = await readAssignments();
  const devices = await readFleetDevices(config.devices);
  const positions = await fetchPositions("/api/positions").catch(() => []);
  const vehicles = (
    await Promise.all(
      devices.map(async (device) => {
        const position = latestPositionForDevice(positions, device.id) ?? (await fetchLatestPosition(device.id).catch(() => null));
        if (!position) return null;
        const assignment = assignments.find((row) => row.deviceId === device.id);
        const assignedLine = lineRoutes.find((line) => line.id === assignment?.assignedLineId);
        const diagnostics = gpsDiagnostics(position);

        return {
          ...device,
          deviceId: device.id,
          internalNumber: assignment?.internalNumber ?? "",
          assignedLineId: assignedLine?.id ?? assignment?.assignedLineId ?? "",
          assignedLineName: assignedLine?.name ?? "",
          label: assignment?.label || device.label,
          line: assignedLine?.number ?? device.line,
          color: assignedLine?.color ?? device.color,
          latitude: position.latitude,
          longitude: position.longitude,
          speedKmh: position.speedKmh,
          course: position.course,
          fixTime: position.fixTime,
          gps: diagnostics
        };
      })
    )
  ).filter(Boolean) as FleetVehicle[];

  return { vehicles, updatedAt: new Date().toISOString(), source: "fresh" };
}

async function fetchLatestPosition(deviceId: number) {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString()
  });

  const positions = await fetchPositions(`/api/positions?${params.toString()}`);
  return latestPositionForDevice(positions, deviceId);
}

function latestPositionForDevice(positions: TraccarPosition[], deviceId: number) {
  return positions
    .filter((position) => position.deviceId === deviceId)
    .sort((a, b) => b.fixTime.localeCompare(a.fixTime))[0];
}

function gpsDiagnostics(position: TraccarPosition) {
  const ageMs = Date.now() - new Date(position.fixTime).getTime();
  const ageSeconds = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null;
  const isFresh = ageSeconds === null ? false : ageSeconds <= 120;
  const isMoving = position.motion === true || position.speedKmh >= 3 || (position.distance ?? 0) > 0;
  const problems = [
    position.valid ? null : "GPS invalido",
    isFresh ? null : "Posicion vieja",
    isMoving ? null : "Sin movimiento",
    position.ignition === false ? "Ignicion apagada" : null,
    position.power === 0 ? "Sin alimentacion externa" : null
  ].filter(Boolean);

  return {
    status: problems.length > 0 ? problems.join(" | ") : "GPS activo",
    valid: position.valid,
    fresh: isFresh,
    moving: isMoving,
    motion: position.motion,
    ignition: position.ignition,
    power: position.power,
    battery: position.battery,
    satellites: position.satellites,
    distance: position.distance,
    ageSeconds
  };
}

async function readCachedFleetSnapshot(): Promise<FleetSnapshot | null> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) return memoryCache.snapshot;

  if (!isRedisConfigured()) return null;
  const cached = await redisCommand<string | null>(["GET", fleetCacheKey]).catch(() => null);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as FleetSnapshot;
  } catch {
    return null;
  }
}

async function writeCachedFleetSnapshot(snapshot: FleetSnapshot) {
  const ttlMs = Math.max(5, fleetCacheTtlSeconds) * 1000;
  memoryCache = { expiresAt: Date.now() + ttlMs, snapshot };

  if (!isRedisConfigured()) return;
  await redisCommand(["SET", fleetCacheKey, JSON.stringify(snapshot), "EX", Math.max(5, fleetCacheTtlSeconds)]).catch(() => null);
}
