import { isRedisConfigured, redisCommand } from "./redis.ts";
import type { LineStop, LineStopDirection } from "./lineStops.ts";
import {
  hashText,
  projectPointOntoRoute,
  type RouteDirection,
  type RouteGeometry,
  type RouteGeometryBundle
} from "./routeGeometry.ts";

export const maxDistanceFromRouteMeters = 100;

export type StopProjection = {
  stopId: string;
  lineId: string;
  direction: RouteDirection;
  stopMeasureMeters: number;
  distanceFromRouteMeters: number;
  segmentIndex: number;
  segmentCourse: number;
  projectedLatitude: number;
  projectedLongitude: number;
  projectionValid: boolean;
  stopEtaReady: boolean;
  diagnostics: StopProjectionDiagnostic[];
  calculatedAt: string;
};

export type StopProjectionDiagnostic = {
  code:
    | "missing_route_geometry"
    | "ambiguous_stop_direction"
    | "stop_not_projectable"
    | "order_missing"
    | "order_inconsistent";
  message: string;
};

export type LineProjectionReadiness = {
  lineId: string;
  lineGeometryReady: boolean;
  stopCount: number;
  stopEtaReadyCount: number;
  projections: StopProjection[];
  orderDiagnostics: Array<{
    stopId: string;
    direction: RouteDirection;
    order?: number;
    stopMeasureMeters: number;
    diagnostics: StopProjectionDiagnostic[];
  }>;
  sourceHash: string;
  stopsHash: string;
  calculatedAt: string;
};

const stopProjectionRedisKeyPrefix = "stop_projection:v1";
const memoryCache = new Map<string, LineProjectionReadiness>();

export async function getOrBuildLineProjectionReadiness(
  lineId: string,
  stops: LineStop[],
  geometryBundle: RouteGeometryBundle
): Promise<LineProjectionReadiness> {
  const lineStops = stops.filter((stop) => stop.lineId === lineId);
  const stopsHash = hashStops(lineStops);
  const cacheKey = projectionCacheKey(lineId, geometryBundle.sourceHash, stopsHash);
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  if (isRedisConfigured()) {
    const response = await redisCommand<string | null>(["GET", stopProjectionRedisKey(lineId)]).catch(() => null);
    if (response) {
      try {
        const parsed = JSON.parse(response) as LineProjectionReadiness;
        if (parsed.sourceHash === geometryBundle.sourceHash && parsed.stopsHash === stopsHash) {
          memoryCache.set(cacheKey, parsed);
          return parsed;
        }
      } catch {
        // Invalid cached projection is ignored and regenerated.
      }
    }
  }

  const readiness = buildLineProjectionReadiness(lineId, lineStops, geometryBundle);
  memoryCache.set(cacheKey, readiness);

  if (isRedisConfigured()) {
    await redisCommand(["SET", stopProjectionRedisKey(lineId), JSON.stringify(readiness)]).catch(() => undefined);
  }

  return readiness;
}

export function buildLineProjectionReadiness(
  lineId: string,
  stops: LineStop[],
  geometryBundle: RouteGeometryBundle
): LineProjectionReadiness {
  const geometriesByDirection = new Map<RouteDirection, RouteGeometry>(
    geometryBundle.geometries.map((geometry) => [geometry.direction, geometry])
  );
  const projections = stops.flatMap((stop) => projectStop(stop, geometriesByDirection));
  const orderDiagnostics = detectOrderDiagnostics(stops, projections);

  for (const orderDiagnostic of orderDiagnostics) {
    const projection = projections.find(
      (candidate) => candidate.stopId === orderDiagnostic.stopId && candidate.direction === orderDiagnostic.direction
    );
    if (!projection) continue;
    projection.diagnostics.push(...orderDiagnostic.diagnostics);
  }

  return {
    lineId,
    lineGeometryReady: hasGeometry(geometriesByDirection, "ida") && hasGeometry(geometriesByDirection, "vuelta"),
    stopCount: stops.length,
    stopEtaReadyCount: projections.filter((projection) => projection.stopEtaReady).length,
    projections,
    orderDiagnostics,
    sourceHash: geometryBundle.sourceHash,
    stopsHash: hashStops(stops),
    calculatedAt: new Date().toISOString()
  };
}

function projectStop(stop: LineStop, geometriesByDirection: Map<RouteDirection, RouteGeometry>): StopProjection[] {
  const directions = directionsForStop(stop.direction);
  const projections = directions.map((direction) => {
    const geometry = geometriesByDirection.get(direction);
    const diagnostics: StopProjectionDiagnostic[] = [];

    if (!geometry) {
      diagnostics.push({
        code: "missing_route_geometry",
        message: `No hay geometria para ${direction}`
      });
      return emptyProjection(stop, direction, diagnostics);
    }

    const projection = projectPointOntoRoute(stop.latitude, stop.longitude, geometry);
    if (!projection) {
      diagnostics.push({
        code: "stop_not_projectable",
        message: "No se pudo proyectar la parada al recorrido"
      });
      return emptyProjection(stop, direction, diagnostics);
    }

    const projectionValid = projection.distanceFromRouteMeters <= maxDistanceFromRouteMeters;
    if (!projectionValid) {
      diagnostics.push({
        code: "stop_not_projectable",
        message: `La parada esta a ${Math.round(projection.distanceFromRouteMeters)}m del recorrido`
      });
      logStopProjection("stop_projection_invalid", {
        lineId: stop.lineId,
        direction,
        distanceFromRouteMeters: Math.round(projection.distanceFromRouteMeters)
      });
    } else {
      logStopProjection("stop_projection_generated", {
        lineId: stop.lineId,
        direction,
        distanceFromRouteMeters: Math.round(projection.distanceFromRouteMeters)
      });
    }

    if (stop.order == null) {
      diagnostics.push({
        code: "order_missing",
        message: "La parada no tiene order cargado"
      });
    }

    return {
      stopId: stop.id,
      lineId: stop.lineId,
      direction,
      stopMeasureMeters: projection.distanceAlongRouteMeters,
      distanceFromRouteMeters: projection.distanceFromRouteMeters,
      segmentIndex: projection.segmentIndex,
      segmentCourse: projection.segmentCourse,
      projectedLatitude: projection.projectedLatitude,
      projectedLongitude: projection.projectedLongitude,
      projectionValid,
      stopEtaReady: stop.direction !== "ambos" && projectionValid,
      diagnostics,
      calculatedAt: new Date().toISOString()
    };
  });

  if (stop.direction === "ambos") {
    for (const projection of projections) {
      projection.stopEtaReady = false;
      projection.diagnostics.push({
        code: "ambiguous_stop_direction",
        message: "La parada usa direction=ambos; para ETA requiere ida o vuelta explicita"
      });
    }
  }

  return projections;
}

function detectOrderDiagnostics(stops: LineStop[], projections: StopProjection[]) {
  const diagnostics: LineProjectionReadiness["orderDiagnostics"] = [];
  for (const direction of ["ida", "vuelta"] satisfies RouteDirection[]) {
    const stopsWithOrder = stops
      .filter((stop) => stop.direction === direction && stop.order != null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let previousProjection: StopProjection | undefined;
    for (const stop of stopsWithOrder) {
      const projection = projections.find((candidate) => candidate.stopId === stop.id && candidate.direction === direction);
      if (!projection) continue;
      if (previousProjection && projection.stopMeasureMeters < previousProjection.stopMeasureMeters) {
        const item = {
          stopId: stop.id,
          direction,
          order: stop.order,
          stopMeasureMeters: projection.stopMeasureMeters,
          diagnostics: [
            {
              code: "order_inconsistent" as const,
              message: `El order ${stop.order} aparece antes geometricamente que una parada anterior`
            }
          ]
        };
        diagnostics.push(item);
        logStopProjection("stop_order_inconsistent", {
          lineId: stop.lineId,
          direction,
          stopMeasureMeters: Math.round(projection.stopMeasureMeters)
        });
      }
      previousProjection = projection;
    }
  }
  return diagnostics;
}

function emptyProjection(
  stop: LineStop,
  direction: RouteDirection,
  diagnostics: StopProjectionDiagnostic[]
): StopProjection {
  return {
    stopId: stop.id,
    lineId: stop.lineId,
    direction,
    stopMeasureMeters: 0,
    distanceFromRouteMeters: Number.POSITIVE_INFINITY,
    segmentIndex: -1,
    segmentCourse: 0,
    projectedLatitude: stop.latitude,
    projectedLongitude: stop.longitude,
    projectionValid: false,
    stopEtaReady: false,
    diagnostics,
    calculatedAt: new Date().toISOString()
  };
}

function directionsForStop(direction: LineStopDirection): RouteDirection[] {
  if (direction === "ida" || direction === "vuelta") return [direction];
  return ["ida", "vuelta"];
}

function hasGeometry(geometriesByDirection: Map<RouteDirection, RouteGeometry>, direction: RouteDirection) {
  const geometry = geometriesByDirection.get(direction);
  return Boolean(geometry && geometry.coordinates.length >= 2 && geometry.totalDistanceMeters > 0);
}

function hashStops(stops: LineStop[]) {
  return hashText(JSON.stringify(stops.map((stop) => ({ ...stop })).sort((a, b) => a.id.localeCompare(b.id))));
}

function projectionCacheKey(lineId: string, sourceHash: string, stopsHash: string) {
  return `${lineId}:${sourceHash}:${stopsHash}`;
}

function stopProjectionRedisKey(lineId: string) {
  return `${stopProjectionRedisKeyPrefix}:${lineId}`;
}

function logStopProjection(
  event: string,
  metadata: {
    lineId?: string;
    direction?: RouteDirection;
    distanceFromRouteMeters?: number;
    stopMeasureMeters?: number;
  } = {}
) {
  console.info(event, metadata);
}
