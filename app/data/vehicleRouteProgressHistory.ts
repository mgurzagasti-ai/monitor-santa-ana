import { isRedisConfigured, redisCommand } from "./redis.ts";
import type { PreviousVehicleRouteProgress, VehicleRouteProjection } from "./vehicleRouteProjection.ts";

export type VehicleRouteProgressSample = PreviousVehicleRouteProgress & {
  deviceId: number;
  fixTimeMs: number;
};

export type VehicleRouteProgressHistory = {
  previous: VehicleRouteProgressSample | null;
  current: VehicleRouteProgressSample;
};

const vehicleRouteProgressHistoryKeyPrefix = "vehicle_route_progress:v1";
export const vehicleRouteProgressHistoryTtlSeconds = Number(process.env.VEHICLE_ROUTE_PROGRESS_HISTORY_TTL_SECONDS ?? 180);
const memoryCache = new Map<string, VehicleRouteProgressHistory>();

const updateHistoryScript = `
local existing = redis.call("GET", KEYS[1])
local sample = cjson.decode(ARGV[1])
local ttl = tonumber(ARGV[2])
if not existing then
  local history = { previous = cjson.null, current = sample }
  redis.call("SET", KEYS[1], cjson.encode(history), "EX", ttl)
  return cjson.encode(history)
end
local history = cjson.decode(existing)
if not history.current or tonumber(sample.fixTimeMs) > tonumber(history.current.fixTimeMs) then
  history = { previous = history.current, current = sample }
  redis.call("SET", KEYS[1], cjson.encode(history), "EX", ttl)
else
  redis.call("EXPIRE", KEYS[1], ttl)
end
return cjson.encode(history)
`;

export async function recordVehicleRouteProgressSample(
  sample: VehicleRouteProgressSample
): Promise<VehicleRouteProgressHistory | null> {
  if (!isValidSample(sample)) return null;

  const key = vehicleRouteProgressHistoryKey(sample);
  if (isRedisConfigured()) {
    const response = await redisCommand<string>([
      "EVAL",
      updateHistoryScript,
      1,
      key,
      JSON.stringify(sample),
      Math.max(60, vehicleRouteProgressHistoryTtlSeconds)
    ]).catch(() => null);
    if (response) {
      try {
        const parsed = JSON.parse(response) as VehicleRouteProgressHistory;
        memoryCache.set(key, parsed);
        return parsed;
      } catch {
        return updateMemoryHistory(key, sample);
      }
    }
  }

  return updateMemoryHistory(key, sample);
}

export function buildVehicleRouteProgressSample({
  deviceId,
  lineId,
  projection,
  fixTime
}: {
  deviceId: number;
  lineId: string;
  projection: Pick<VehicleRouteProjection, "lineId" | "direction" | "vehicleMeasureMeters" | "distanceFromRouteMeters">;
  fixTime: string;
}): VehicleRouteProgressSample | null {
  const fixTimeMs = new Date(fixTime).getTime();
  if (!Number.isFinite(deviceId) || deviceId <= 0 || !Number.isFinite(fixTimeMs)) return null;
  if (projection.lineId !== lineId) return null;

  return {
    deviceId,
    lineId,
    direction: projection.direction,
    vehicleMeasureMeters: projection.vehicleMeasureMeters,
    distanceFromRouteMeters: projection.distanceFromRouteMeters,
    fixTime,
    fixTimeMs
  };
}

export function resetVehicleRouteProgressHistoryForTests() {
  memoryCache.clear();
}

function updateMemoryHistory(key: string, sample: VehicleRouteProgressSample): VehicleRouteProgressHistory {
  const existing = memoryCache.get(key);
  if (!existing) {
    const history = { previous: null, current: sample };
    memoryCache.set(key, history);
    return history;
  }

  if (sample.fixTimeMs > existing.current.fixTimeMs) {
    const history = { previous: existing.current, current: sample };
    memoryCache.set(key, history);
    return history;
  }

  return existing;
}

function vehicleRouteProgressHistoryKey(sample: Pick<VehicleRouteProgressSample, "deviceId" | "lineId" | "direction">) {
  return `${vehicleRouteProgressHistoryKeyPrefix}:${sample.deviceId}:${sample.lineId}:${sample.direction}`;
}

function isValidSample(sample: VehicleRouteProgressSample) {
  return (
    Number.isFinite(sample.deviceId) &&
    sample.deviceId > 0 &&
    typeof sample.lineId === "string" &&
    sample.lineId.length > 0 &&
    (sample.direction === "ida" || sample.direction === "vuelta") &&
    Number.isFinite(sample.vehicleMeasureMeters) &&
    Number.isFinite(sample.distanceFromRouteMeters) &&
    Number.isFinite(sample.fixTimeMs) &&
    typeof sample.fixTime === "string" &&
    sample.fixTime.length > 0
  );
}
