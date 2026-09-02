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
const fleetStaleCacheKey = "fleet_snapshot_stale_v1";
const fleetRefreshLockKey = "fleet_snapshot_refresh_lock_v1";
const fleetCacheTtlSeconds = Number(process.env.FLEET_CACHE_TTL_SECONDS ?? 20);
const fleetStaleCacheTtlSeconds = 300;
const fleetRefreshLockTtlSeconds = 20;
const lockWaitAttempts = 3;
const lockWaitMs = 125;
let memoryCache: { expiresAt: number; snapshot: FleetSnapshot } | null = null;
let memoryStaleCache: { expiresAt: number; snapshot: FleetSnapshot } | null = null;

export async function getFleetSnapshot(options: { forceFresh?: boolean } = {}): Promise<FleetSnapshot> {
  if (!options.forceFresh) {
    const cached = await readFreshFleetSnapshot();
    if (cached) return { ...cached, source: "cache" };
  }

  const stale = await readStaleFleetSnapshot();
  const lock = await acquireFleetRefreshLock();

  if (lock === "acquired") {
    return refreshFleetSnapshot(stale);
  }

  if (lock === "busy") {
    logFleetCache("fleet_snapshot_lock_busy");
    if (stale) {
      logFleetCache("fleet_snapshot_stale_hit", { cacheAgeSeconds: cacheAgeSeconds(stale) });
      return { ...stale, source: "cache" };
    }

    for (let attempt = 1; attempt <= lockWaitAttempts; attempt += 1) {
      await sleep(lockWaitMs);
      logFleetCache("fleet_snapshot_wait_retry", { attempt });
      const cached = await readRedisFleetSnapshot();
      if (cached) return { ...cached, source: "cache" };
    }

    throw new Error("Fleet snapshot refresh in progress");
  }

  if (stale) {
    logFleetCache("fleet_snapshot_stale_hit", { cacheAgeSeconds: cacheAgeSeconds(stale) });
    return { ...stale, source: "cache" };
  }

  return refreshFleetSnapshot(null);
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
  let traccarError: unknown = null;
  const fallbackErrors: unknown[] = [];
  logFleetCache("fleet_snapshot_traccar_positions_fetch");
  const positions = await fetchPositions("/api/positions").catch((error) => {
    traccarError = error;
    return [];
  });
  const vehicles = (
    await Promise.all(
      devices.map(async (device) => {
        const position =
          latestPositionForDevice(positions, device.id) ??
          (await fetchLatestPosition(device.id).catch((error) => {
            fallbackErrors.push(error);
            return null;
          }));
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

  if (vehicles.length === 0 && (traccarError || fallbackErrors.length > 0)) {
    throw new Error("No se pudo obtener posiciones de Traccar");
  }

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

async function readFreshFleetSnapshot(): Promise<FleetSnapshot | null> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    logFleetCache("fleet_snapshot_memory_hit", { cacheAgeSeconds: cacheAgeSeconds(memoryCache.snapshot) });
    return memoryCache.snapshot;
  }

  return readRedisFleetSnapshot();
}

async function readRedisFleetSnapshot(): Promise<FleetSnapshot | null> {
  if (!isRedisConfigured()) return null;
  const cached = await redisCommand<string | null>(["GET", fleetCacheKey]).catch((error) => {
    logFleetCache("fleet_snapshot_redis_error", { error });
    return null;
  });
  if (!cached) return null;

  try {
    const snapshot = JSON.parse(cached) as FleetSnapshot;
    logFleetCache("fleet_snapshot_redis_hit", { cacheAgeSeconds: cacheAgeSeconds(snapshot) });
    return snapshot;
  } catch {
    return null;
  }
}

async function writeCachedFleetSnapshot(snapshot: FleetSnapshot) {
  const ttlMs = Math.max(5, fleetCacheTtlSeconds) * 1000;
  memoryCache = { expiresAt: Date.now() + ttlMs, snapshot };
  memoryStaleCache = { expiresAt: Date.now() + fleetStaleCacheTtlSeconds * 1000, snapshot };

  if (!isRedisConfigured()) return;
  await redisCommand(["SET", fleetCacheKey, JSON.stringify(snapshot), "EX", Math.max(5, fleetCacheTtlSeconds)]).catch((error) => {
    logFleetCache("fleet_snapshot_redis_error", { error });
  });
  await redisCommand(["SET", fleetStaleCacheKey, JSON.stringify(snapshot), "EX", fleetStaleCacheTtlSeconds]).catch((error) => {
    logFleetCache("fleet_snapshot_redis_error", { error });
  });
}

async function readStaleFleetSnapshot(): Promise<FleetSnapshot | null> {
  const now = Date.now();
  if (memoryStaleCache && memoryStaleCache.expiresAt > now && isSnapshotRecent(memoryStaleCache.snapshot)) {
    return memoryStaleCache.snapshot;
  }

  if (!isRedisConfigured()) return null;
  const cached = await redisCommand<string | null>(["GET", fleetStaleCacheKey]).catch((error) => {
    logFleetCache("fleet_snapshot_redis_error", { error });
    return null;
  });
  if (!cached) return null;

  try {
    const snapshot = JSON.parse(cached) as FleetSnapshot;
    if (!isSnapshotRecent(snapshot)) return null;
    memoryStaleCache = { expiresAt: Date.now() + fleetStaleCacheTtlSeconds * 1000, snapshot };
    return snapshot;
  } catch {
    return null;
  }
}

async function acquireFleetRefreshLock(): Promise<"acquired" | "busy" | "unavailable"> {
  if (!isRedisConfigured()) return "unavailable";

  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const response = await redisCommand<"OK" | null>([
      "SET",
      fleetRefreshLockKey,
      token,
      "NX",
      "EX",
      fleetRefreshLockTtlSeconds
    ]);
    if (response === "OK") {
      logFleetCache("fleet_snapshot_lock_acquired");
      return "acquired";
    }
    return "busy";
  } catch (error) {
    logFleetCache("fleet_snapshot_redis_error", { error });
    return "unavailable";
  }
}

async function refreshFleetSnapshot(stale: FleetSnapshot | null): Promise<FleetSnapshot> {
  const startedAt = Date.now();
  logFleetCache("fleet_snapshot_refresh_started");
  try {
    const snapshot = await buildFleetSnapshot();
    await writeCachedFleetSnapshot(snapshot);
    logFleetCache("fleet_snapshot_refresh_completed", {
      durationMs: Date.now() - startedAt,
      vehicleCount: snapshot.vehicles.length
    });
    return snapshot;
  } catch (error) {
    logFleetCache("fleet_snapshot_refresh_failed", { durationMs: Date.now() - startedAt, error });
    if (stale) {
      logFleetCache("fleet_snapshot_stale_hit", { cacheAgeSeconds: cacheAgeSeconds(stale) });
      return { ...stale, source: "cache" };
    }
    throw error;
  }
}

function isSnapshotRecent(snapshot: FleetSnapshot) {
  const ageSeconds = cacheAgeSeconds(snapshot);
  return ageSeconds !== null && ageSeconds <= fleetStaleCacheTtlSeconds;
}

function cacheAgeSeconds(snapshot: FleetSnapshot) {
  const updatedAt = new Date(snapshot.updatedAt).getTime();
  return Number.isFinite(updatedAt) ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logFleetCache(
  event: string,
  metadata: { durationMs?: number; cacheAgeSeconds?: number | null; vehicleCount?: number; attempt?: number; error?: unknown } = {}
) {
  const { error, ...safeMetadata } = metadata;
  const errorMessage = error instanceof Error ? error.message : error ? "Unknown error" : undefined;
  console.info(event, errorMessage ? { ...safeMetadata, error: errorMessage } : safeMetadata);
}
