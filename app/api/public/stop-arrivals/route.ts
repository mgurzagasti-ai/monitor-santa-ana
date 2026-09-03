import { NextRequest, NextResponse } from "next/server.js";
import { lineRoutes, type LineRouteDefinition } from "../../../data/lineRoutes.ts";
import { getCachedRouteGeometryBundle, type RouteGeometryBundle } from "../../../data/routeGeometry.ts";
import { getOrBuildLineProjectionReadiness, type StopProjection } from "../../../data/stopProjections.ts";
import { evaluateVehicleForStop, type VehicleStopState } from "../../../data/vehicleRouteProjection.ts";
import { estimateEtaForVehicleStop, type EtaEstimate } from "../../../data/etaEstimate.ts";

export const dynamic = "force-dynamic";

type LineStop = {
  id: string;
  lineId: string;
  name: string;
  latitude: number;
  longitude: number;
  direction: "ida" | "vuelta" | "ambos";
  order?: number;
};

type FleetVehicle = {
  assignedLineId: string;
  internalNumber: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number | null;
  fixTime: string;
};

type FleetSnapshot = {
  vehicles: FleetVehicle[];
  updatedAt: string | null;
  source: "fresh" | "cache";
};
type PublicArrival = {
  internalNumber: string;
  direction: "ida" | "vuelta";
  status: "approaching" | "arriving";
  etaMinutes: number;
  distanceRemainingMeters: number;
};

type StopArrivalsResponse = {
  lineId: string;
  stopId: string;
  etaAvailable: boolean;
  updatedAt: string | null;
  arrivals: PublicArrival[];
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export type StopArrivalsDependencies = {
  lineRoutes: LineRouteDefinition[];
  readLineStops: () => Promise<LineStop[]>;
  getCachedRouteGeometryBundle: (lineId: string) => Promise<RouteGeometryBundle | null>;
  getOrBuildLineProjectionReadiness: typeof getOrBuildLineProjectionReadiness;
  getFleetSnapshot: () => Promise<FleetSnapshot>;
  evaluateVehicleForStop: typeof evaluateVehicleForStop;
  estimateEtaForVehicleStop: typeof estimateEtaForVehicleStop;
  checkRateLimit: (ip: string, route: string, options: { limit: number; windowSeconds: number }) => Promise<RateLimitResult>;
  now: () => Date;
};

const publicCacheHeaders = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=10, stale-while-revalidate=20"
};

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store"
};

export async function GET(request: NextRequest) {
  const [{ getFleetSnapshot }, { checkRateLimit }, { readLineStops }] = await Promise.all([
    import("../../../data/fleet.ts"),
    import("../../../data/rateLimit.ts"),
    import("../../../data/lineStops.ts")
  ]);

  return createStopArrivalsHandler({
    lineRoutes,
    readLineStops,
    getCachedRouteGeometryBundle,
    getOrBuildLineProjectionReadiness,
    getFleetSnapshot,
    evaluateVehicleForStop,
    estimateEtaForVehicleStop,
    checkRateLimit,
    now: () => new Date()
  })(request);
}

export function createStopArrivalsHandler(dependencies: StopArrivalsDependencies) {
  return async function stopArrivalsHandler(request: NextRequest) {
    try {
      const rateLimit = await dependencies.checkRateLimit(getClientIp(request), "stop-arrivals", {
        limit: 600,
        windowSeconds: 60
      });
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too Many Requests" },
          {
            status: 429,
            headers: {
              ...privateNoStoreHeaders,
              "Retry-After": String(rateLimit.retryAfterSeconds)
            }
          }
        );
      }

      const lineId = request.nextUrl.searchParams.get("lineId")?.trim();
      const stopId = request.nextUrl.searchParams.get("stopId")?.trim();
      if (!lineId || !stopId) {
        return NextResponse.json({ error: "Faltan parametros lineId y stopId" }, { status: 400, headers: privateNoStoreHeaders });
      }

      const line = dependencies.lineRoutes.find((candidate) => candidate.id === lineId);
      if (!line) {
        return NextResponse.json({ error: "Linea no encontrada" }, { status: 404, headers: privateNoStoreHeaders });
      }

      const stops = await dependencies.readLineStops();
      const stop = stops.find((candidate) => candidate.id === stopId);
      if (!stop || stop.lineId !== line.id) {
        return NextResponse.json({ error: "Parada no encontrada" }, { status: 404, headers: privateNoStoreHeaders });
      }

      const currentTime = dependencies.now();
      const fallbackUpdatedAt = currentTime.toISOString();
      const geometryBundle = await dependencies.getCachedRouteGeometryBundle(line.id);
      if (!geometryBundle || !isRouteGeometryReady(geometryBundle)) {
        return NextResponse.json(emptyResponse(line.id, stop.id, null), { headers: publicCacheHeaders });
      }

      const readiness = await dependencies.getOrBuildLineProjectionReadiness(line.id, stops, geometryBundle);
      const stopProjection = findReadyStopProjection(readiness.projections, stop.id);
      if (!stopProjection) {
        return NextResponse.json(emptyResponse(line.id, stop.id, null), { headers: publicCacheHeaders });
      }

      const fleet = await dependencies.getFleetSnapshot();
      const updatedAt = isValidTimestamp(fleet.updatedAt) ? fleet.updatedAt : null;
      const arrivals = fleet.vehicles
        .filter((vehicle) => vehicle.assignedLineId === line.id)
        .map((vehicle, index) => buildPublicArrival(vehicle, geometryBundle, stopProjection, currentTime, index, dependencies))
        .filter((arrival): arrival is PublicArrival & { sortIndex: number } => arrival !== null)
        .sort(compareArrivals)
        .map(({ sortIndex: _sortIndex, ...arrival }) => arrival);

      return NextResponse.json(
        {
          lineId: line.id,
          stopId: stop.id,
          etaAvailable: arrivals.length > 0,
          updatedAt,
          arrivals
        } satisfies StopArrivalsResponse,
        { headers: publicCacheHeaders }
      );
    } catch (error) {
      return NextResponse.json(
        { error: "Internal Server Error" },
        {
          status: 500,
          headers: privateNoStoreHeaders
        }
      );
    }
  };
}

function buildPublicArrival(
  vehicle: FleetVehicle,
  geometryBundle: RouteGeometryBundle,
  stopProjection: StopProjection,
  currentTime: Date,
  sortIndex: number,
  dependencies: StopArrivalsDependencies
): (PublicArrival & { sortIndex: number }) | null {
  const state = dependencies.evaluateVehicleForStop({ vehicle, geometryBundle, stopProjection });
  const eta = dependencies.estimateEtaForVehicleStop(state, vehicle, { currentTime });

  if (state.status === "arriving") {
    return publicArrival(vehicle, state, eta, sortIndex);
  }

  if (state.status === "approaching" && Number.isFinite(eta.etaMinutes)) {
    return publicArrival(vehicle, state, eta, sortIndex);
  }

  return null;
}

function publicArrival(
  vehicle: FleetVehicle,
  state: VehicleStopState,
  eta: EtaEstimate,
  sortIndex: number
): (PublicArrival & { sortIndex: number }) | null {
  if (state.direction !== "ida" && state.direction !== "vuelta") return null;
  if (eta.etaMinutes === null || !Number.isFinite(eta.etaMinutes)) return null;

  const distanceRemainingMeters = state.distanceRemainingMeters ?? 0;
  if (!Number.isFinite(distanceRemainingMeters)) return null;

  return {
    internalNumber: vehicle.internalNumber,
    direction: state.direction,
    status: state.status === "arriving" ? "arriving" : "approaching",
    etaMinutes: eta.etaMinutes,
    distanceRemainingMeters: Math.max(0, Math.round(distanceRemainingMeters)),
    sortIndex
  };
}

function findReadyStopProjection(projections: StopProjection[], stopId: string) {
  return projections.find(
    (projection) => projection.stopId === stopId && projection.stopEtaReady === true && projection.projectionValid === true
  );
}

function isRouteGeometryReady(geometryBundle: RouteGeometryBundle) {
  return ["ida", "vuelta"].every((direction) =>
    geometryBundle.geometries.some(
      (geometry) => geometry.direction === direction && geometry.coordinates.length >= 2 && geometry.totalDistanceMeters > 0
    )
  );
}

function emptyResponse(lineId: string, stopId: string, updatedAt: string | null): StopArrivalsResponse {
  return {
    lineId,
    stopId,
    etaAvailable: false,
    updatedAt,
    arrivals: []
  };
}

function compareArrivals(first: PublicArrival & { sortIndex: number }, second: PublicArrival & { sortIndex: number }) {
  const statusDifference = statusRank(first.status) - statusRank(second.status);
  if (statusDifference !== 0) return statusDifference;
  const etaDifference = first.etaMinutes - second.etaMinutes;
  if (etaDifference !== 0) return etaDifference;
  const distanceDifference = first.distanceRemainingMeters - second.distanceRemainingMeters;
  if (distanceDifference !== 0) return distanceDifference;
  return first.sortIndex - second.sortIndex;
}

function statusRank(status: PublicArrival["status"]) {
  return status === "arriving" ? 0 : 1;
}

function isValidTimestamp(value: string | null) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function getClientIp(request: NextRequest) {
  const headerValue =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  const ip = headerValue.split(",")[0]?.trim();

  return ip || "unknown";
}
