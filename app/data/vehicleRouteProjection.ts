import type { FleetVehicle } from "./fleet.ts";
import type { RouteDirection, RouteGeometry, RouteGeometryBundle } from "./routeGeometry.ts";
import { projectPointOntoRoute } from "./routeGeometry.ts";
import type { StopProjection } from "./stopProjections.ts";

export const maxVehicleDistanceFromRouteMeters = 100;
export const ambiguousRouteDistanceDifferenceMeters = 30;
export const courseCompatibilityDegrees = 60;
export const arrivingBeforeMeters = 80;
export const passedAfterMeters = 40;

export type VehicleRouteProjection = {
  lineId: string;
  direction: "ida" | "vuelta";
  vehicleMeasureMeters: number;
  distanceFromRouteMeters: number;
  segmentIndex: number;
  segmentCourse: number | null;
  projectedLatitude: number;
  projectedLongitude: number;
};

export type VehicleStopStatus = "approaching" | "arriving" | "passed" | "no_prediction";

export type VehicleStopStateReason =
  | "vehicle_off_route"
  | "ambiguous_direction"
  | "missing_course"
  | "stop_not_ready"
  | "route_not_ready"
  | "unsupported_circular"
  | "invalid_vehicle_data";

export type VehicleStopState = {
  status: VehicleStopStatus;
  direction: "ida" | "vuelta" | null;
  vehicleMeasureMeters: number | null;
  stopMeasureMeters: number;
  distanceRemainingMeters: number | null;
  distanceFromRouteMeters: number | null;
  reason?: VehicleStopStateReason;
};

export type VehicleProjectionInput = Pick<
  FleetVehicle,
  "assignedLineId" | "latitude" | "longitude" | "course" | "speedKmh" | "fixTime"
>;

type DirectionCandidate = {
  direction: "ida" | "vuelta";
  projection: VehicleRouteProjection;
  courseDifference: number | null;
  courseCompatible: boolean | null;
};

export function projectVehicleOntoRoute(
  vehicle: VehicleProjectionInput,
  geometryBundle: RouteGeometryBundle
): VehicleRouteProjection | null {
  const result = selectVehicleDirection(vehicle, geometryBundle);
  return result.selected?.projection ?? null;
}

export function evaluateVehicleForStop({
  vehicle,
  geometryBundle,
  stopProjection
}: {
  vehicle: VehicleProjectionInput;
  geometryBundle: RouteGeometryBundle;
  stopProjection: StopProjection;
}): VehicleStopState {
  if (!Number.isFinite(stopProjection.stopMeasureMeters)) {
    return noPrediction(stopProjection.stopMeasureMeters, "stop_not_ready");
  }

  if (!stopProjection.stopEtaReady || !stopProjection.projectionValid) {
    return noPrediction(stopProjection.stopMeasureMeters, "stop_not_ready");
  }

  if (stopProjection.direction === "circular") {
    return noPrediction(stopProjection.stopMeasureMeters, "unsupported_circular");
  }

  const selection = selectVehicleDirection(vehicle, geometryBundle);
  if (selection.reason || !selection.selected) {
    return noPrediction(stopProjection.stopMeasureMeters, selection.reason ?? "route_not_ready");
  }

  const vehicleProjection = selection.selected.projection;
  if (vehicleProjection.direction !== stopProjection.direction) {
    return {
      status: "no_prediction",
      direction: vehicleProjection.direction,
      vehicleMeasureMeters: vehicleProjection.vehicleMeasureMeters,
      stopMeasureMeters: stopProjection.stopMeasureMeters,
      distanceRemainingMeters: null,
      distanceFromRouteMeters: vehicleProjection.distanceFromRouteMeters,
      reason: "ambiguous_direction"
    };
  }

  const distanceDifference = stopProjection.stopMeasureMeters - vehicleProjection.vehicleMeasureMeters;
  if (vehicleProjection.vehicleMeasureMeters < stopProjection.stopMeasureMeters - arrivingBeforeMeters) {
    return {
      status: "approaching",
      direction: vehicleProjection.direction,
      vehicleMeasureMeters: vehicleProjection.vehicleMeasureMeters,
      stopMeasureMeters: stopProjection.stopMeasureMeters,
      distanceRemainingMeters: distanceDifference,
      distanceFromRouteMeters: vehicleProjection.distanceFromRouteMeters
    };
  }

  if (vehicleProjection.vehicleMeasureMeters <= stopProjection.stopMeasureMeters + passedAfterMeters) {
    return {
      status: "arriving",
      direction: vehicleProjection.direction,
      vehicleMeasureMeters: vehicleProjection.vehicleMeasureMeters,
      stopMeasureMeters: stopProjection.stopMeasureMeters,
      distanceRemainingMeters: Math.max(0, distanceDifference),
      distanceFromRouteMeters: vehicleProjection.distanceFromRouteMeters
    };
  }

  return {
    status: "passed",
    direction: vehicleProjection.direction,
    vehicleMeasureMeters: vehicleProjection.vehicleMeasureMeters,
    stopMeasureMeters: stopProjection.stopMeasureMeters,
    distanceRemainingMeters: null,
    distanceFromRouteMeters: vehicleProjection.distanceFromRouteMeters
  };
}

export function selectVehicleDirection(
  vehicle: VehicleProjectionInput,
  geometryBundle: RouteGeometryBundle
): { selected: DirectionCandidate | null; candidates: DirectionCandidate[]; reason?: VehicleStopStateReason } {
  if (!isValidVehiclePosition(vehicle)) {
    return { selected: null, candidates: [], reason: "invalid_vehicle_data" };
  }

  const candidates = buildDirectionCandidates(vehicle, geometryBundle);
  if (candidates.length === 0) {
    return { selected: null, candidates, reason: "route_not_ready" };
  }

  const onRouteCandidates = candidates.filter(
    (candidate) => candidate.projection.distanceFromRouteMeters <= maxVehicleDistanceFromRouteMeters
  );
  if (onRouteCandidates.length === 0) {
    return { selected: null, candidates, reason: "vehicle_off_route" };
  }

  if (onRouteCandidates.length === 1) {
    return { selected: onRouteCandidates[0], candidates };
  }

  const sortedByDistance = [...onRouteCandidates].sort(
    (a, b) => a.projection.distanceFromRouteMeters - b.projection.distanceFromRouteMeters
  );
  const distanceDifference =
    sortedByDistance[1].projection.distanceFromRouteMeters - sortedByDistance[0].projection.distanceFromRouteMeters;
  if (distanceDifference >= ambiguousRouteDistanceDifferenceMeters) {
    return { selected: sortedByDistance[0], candidates };
  }

  const compatible = sortedByDistance.filter((candidate) => candidate.courseCompatible === true);
  if (compatible.length === 1) {
    return { selected: compatible[0], candidates };
  }

  return {
    selected: null,
    candidates,
    reason: hasUsableCourse(vehicle.course) ? "ambiguous_direction" : "missing_course"
  };
}

export function angularDifferenceDegrees(first: number, second: number) {
  const rawDifference = Math.abs(normalizeCourse(first) - normalizeCourse(second));
  return Math.min(rawDifference, 360 - rawDifference);
}

function buildDirectionCandidates(vehicle: VehicleProjectionInput, geometryBundle: RouteGeometryBundle) {
  const candidates: DirectionCandidate[] = [];
  for (const direction of ["ida", "vuelta"] satisfies Array<"ida" | "vuelta">) {
    const geometry = geometryBundle.geometries.find((candidate) => candidate.direction === direction);
    if (!geometry) continue;

    const projection = projectPointOntoRoute(vehicle.latitude, vehicle.longitude, geometry);
    if (!projection) continue;

    const vehicleCourse = hasUsableCourse(vehicle.course) ? vehicle.course : null;
    const courseDifference = vehicleCourse === null ? null : angularDifferenceDegrees(vehicleCourse, projection.segmentCourse);
    candidates.push({
      direction,
      projection: {
        lineId: geometry.lineId,
        direction,
        vehicleMeasureMeters: projection.distanceAlongRouteMeters,
        distanceFromRouteMeters: projection.distanceFromRouteMeters,
        segmentIndex: projection.segmentIndex,
        segmentCourse: projection.segmentCourse,
        projectedLatitude: projection.projectedLatitude,
        projectedLongitude: projection.projectedLongitude
      },
      courseDifference,
      courseCompatible: courseDifference === null ? null : courseDifference <= courseCompatibilityDegrees
    });
  }
  return candidates;
}

function isValidVehiclePosition(vehicle: VehicleProjectionInput) {
  return (
    Number.isFinite(vehicle.latitude) &&
    Number.isFinite(vehicle.longitude) &&
    typeof vehicle.assignedLineId === "string" &&
    vehicle.assignedLineId.length > 0
  );
}

function hasUsableCourse(course: number | null) {
  return course !== null && Number.isFinite(course);
}

function normalizeCourse(course: number) {
  return ((course % 360) + 360) % 360;
}

function noPrediction(stopMeasureMeters: number, reason: VehicleStopStateReason): VehicleStopState {
  return {
    status: "no_prediction",
    direction: null,
    vehicleMeasureMeters: null,
    stopMeasureMeters,
    distanceRemainingMeters: null,
    distanceFromRouteMeters: null,
    reason
  };
}
