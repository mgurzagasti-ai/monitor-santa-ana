import type { VehicleStopState } from "./vehicleRouteProjection.ts";

export const minUsableSpeedKmh = 5;
export const maxUsableSpeedKmh = 60;
export const defaultUrbanSpeedKmh = 15;
export const maxPositionAgeSeconds = 120;

export type EtaConfidence = "current_speed" | "default_speed" | "arriving" | "not_available";

export type EtaEstimateReason =
  | "state_not_predictable"
  | "invalid_distance"
  | "stale_position"
  | "invalid_fix_time";

export type EtaEstimate = {
  etaMinutes: number | null;
  etaMinutesRaw: number | null;
  effectiveSpeedKmh: number | null;
  confidence: EtaConfidence;
  reason?: EtaEstimateReason;
};

export type EtaVehicleInput = {
  speedKmh?: number | null;
  fixTime?: string | null;
};

export type EtaEstimateOptions = {
  currentTime: Date | string | number;
  minUsableSpeedKmh?: number;
  maxUsableSpeedKmh?: number;
  defaultUrbanSpeedKmh?: number;
  maxPositionAgeSeconds?: number;
};

export function estimateEtaForVehicleStop(
  state: VehicleStopState,
  vehicle: EtaVehicleInput,
  options: EtaEstimateOptions
): EtaEstimate {
  if (state.status === "arriving") {
    return {
      etaMinutes: 0,
      etaMinutesRaw: 0,
      effectiveSpeedKmh: 0,
      confidence: "arriving"
    };
  }

  if (state.status !== "approaching") {
    return notAvailable("state_not_predictable");
  }

  const positionAgeSeconds = getPositionAgeSeconds(vehicle.fixTime, options.currentTime);
  if (positionAgeSeconds === null) {
    return notAvailable("invalid_fix_time");
  }

  const maxAgeSeconds = options.maxPositionAgeSeconds ?? maxPositionAgeSeconds;
  if (positionAgeSeconds > maxAgeSeconds) {
    return notAvailable("stale_position");
  }

  const distanceRemainingMeters = state.distanceRemainingMeters;
  if (!Number.isFinite(distanceRemainingMeters) || distanceRemainingMeters === null || distanceRemainingMeters <= 0) {
    return notAvailable("invalid_distance");
  }

  const speed = effectiveSpeedKmh(vehicle.speedKmh, options);
  const etaMinutesRaw = (distanceRemainingMeters / 1000 / speed.effectiveSpeedKmh) * 60;
  if (!Number.isFinite(etaMinutesRaw)) {
    return notAvailable("invalid_distance");
  }

  return {
    etaMinutes: Math.max(1, Math.ceil(etaMinutesRaw)),
    etaMinutesRaw,
    effectiveSpeedKmh: speed.effectiveSpeedKmh,
    confidence: speed.confidence
  };
}

export function effectiveSpeedKmh(
  speedKmh: number | null | undefined,
  options: Pick<EtaEstimateOptions, "minUsableSpeedKmh" | "maxUsableSpeedKmh" | "defaultUrbanSpeedKmh"> = {}
): { effectiveSpeedKmh: number; confidence: "current_speed" | "default_speed" } {
  const minSpeed = options.minUsableSpeedKmh ?? minUsableSpeedKmh;
  const maxSpeed = options.maxUsableSpeedKmh ?? maxUsableSpeedKmh;
  const defaultSpeed = options.defaultUrbanSpeedKmh ?? defaultUrbanSpeedKmh;

  const numericSpeed = typeof speedKmh === "number" ? speedKmh : Number.NaN;
  if (!Number.isFinite(numericSpeed) || numericSpeed < minSpeed) {
    return { effectiveSpeedKmh: defaultSpeed, confidence: "default_speed" };
  }

  return {
    effectiveSpeedKmh: Math.min(numericSpeed, maxSpeed),
    confidence: "current_speed"
  };
}

export function getPositionAgeSeconds(fixTime: string | null | undefined, currentTime: Date | string | number) {
  const fixTimeMs = typeof fixTime === "string" && fixTime.trim() ? new Date(fixTime).getTime() : Number.NaN;
  const currentTimeMs = new Date(currentTime).getTime();
  if (!Number.isFinite(fixTimeMs) || !Number.isFinite(currentTimeMs)) return null;
  return Math.max(0, Math.round((currentTimeMs - fixTimeMs) / 1000));
}

function notAvailable(reason: EtaEstimateReason): EtaEstimate {
  return {
    etaMinutes: null,
    etaMinutesRaw: null,
    effectiveSpeedKmh: null,
    confidence: "not_available",
    reason
  };
}
