import { createHash } from "node:crypto";
import { isRedisConfigured, redisCommand } from "./redis.ts";
import type { LineRouteDefinition } from "./lineRoutes.ts";

export type RouteDirection = "ida" | "vuelta" | "circular";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteGeometry = {
  lineId: string;
  direction: RouteDirection;
  coordinates: RouteCoordinate[];
  cumulativeDistanceMeters: number[];
  totalDistanceMeters: number;
  sourceHash: string;
  updatedAt: string;
};

export type RouteProjection = {
  distanceAlongRouteMeters: number;
  distanceFromRouteMeters: number;
  segmentIndex: number;
  segmentCourse: number;
  projectedLatitude: number;
  projectedLongitude: number;
};

export type RouteGeometryDiagnostic = {
  lineId: string;
  direction?: RouteDirection;
  code: "missing_direction" | "too_few_coordinates" | "invalid_distance" | "duplicate_direction" | "fetch_failed";
  message: string;
};

export type RouteGeometryBundle = {
  lineId: string;
  sourceHash: string;
  geometries: RouteGeometry[];
  diagnostics: RouteGeometryDiagnostic[];
  updatedAt: string;
};

type KmlPath = {
  name: string;
  coordinates: RouteCoordinate[];
};

const routeGeometryRedisKeyPrefix = "route_geometry:v1";
const minimumCoordinateCount = 2;
const earthRadiusMeters = 6_371_000;
const metersPerDegreeLatitude = 111_320;
const memoryCache = new Map<string, RouteGeometryBundle>();

export async function getCachedRouteGeometryBundle(lineId: string): Promise<RouteGeometryBundle | null> {
  const cached = memoryCache.get(lineId);
  if (cached) {
    logRouteGeometry("route_geometry_cache_hit", {
      lineId,
      coordinateCount: cached.geometries.reduce((total, geometry) => total + geometry.coordinates.length, 0)
    });
    return cached;
  }

  if (!isRedisConfigured()) return null;

  const response = await redisCommand<string | null>(["GET", routeGeometryRedisKey(lineId)]).catch(() => null);
  if (!response) return null;

  try {
    const bundle = JSON.parse(response) as RouteGeometryBundle;
    memoryCache.set(lineId, bundle);
    logRouteGeometry("route_geometry_cache_hit", {
      lineId,
      coordinateCount: bundle.geometries.reduce((total, geometry) => total + geometry.coordinates.length, 0)
    });
    return bundle;
  } catch {
    return null;
  }
}

export async function getOrBuildRouteGeometryBundle(line: LineRouteDefinition): Promise<RouteGeometryBundle> {
  const startedAt = Date.now();
  try {
    const response = await fetch(line.kmlUrl, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const kml = await response.text();
    const sourceHash = hashText(kml);
    const cached = await getCachedRouteGeometryBundle(line.id);
    if (cached?.sourceHash === sourceHash) return cached;

    const bundle = buildRouteGeometryBundleFromKml(line.id, kml, sourceHash);
    await writeRouteGeometryBundle(bundle);
    logRouteGeometry("route_geometry_generated", {
      lineId: line.id,
      durationMs: Date.now() - startedAt,
      coordinateCount: bundle.geometries.reduce((total, geometry) => total + geometry.coordinates.length, 0),
      totalDistanceMeters: Math.round(bundle.geometries.reduce((total, geometry) => total + geometry.totalDistanceMeters, 0))
    });
    return bundle;
  } catch (error) {
    const cached = await getCachedRouteGeometryBundle(line.id);
    if (cached) return cached;

    logRouteGeometry("route_geometry_invalid", { lineId: line.id, durationMs: Date.now() - startedAt });
    return {
      lineId: line.id,
      sourceHash: "",
      geometries: [],
      diagnostics: [
        {
          lineId: line.id,
          code: "fetch_failed",
          message: error instanceof Error ? error.message : "No se pudo obtener KML"
        }
      ],
      updatedAt: new Date().toISOString()
    };
  }
}

export function buildRouteGeometryBundleFromKml(
  lineId: string,
  kml: string,
  sourceHash = hashText(kml)
): RouteGeometryBundle {
  const updatedAt = new Date().toISOString();
  const diagnostics: RouteGeometryDiagnostic[] = [];
  const geometries: RouteGeometry[] = [];
  const seenDirections = new Set<RouteDirection>();

  for (const path of parseKmlLineStringPaths(kml)) {
    const direction = inferRouteDirection(path.name);
    if (!direction) {
      diagnostics.push({
        lineId,
        code: "missing_direction",
        message: `No se pudo identificar ida/vuelta en "${path.name || "sin nombre"}"`
      });
      continue;
    }

    if (seenDirections.has(direction)) {
      diagnostics.push({
        lineId,
        direction,
        code: "duplicate_direction",
        message: `Hay mas de un recorrido para ${direction}`
      });
      continue;
    }
    seenDirections.add(direction);

    if (path.coordinates.length < minimumCoordinateCount) {
      diagnostics.push({
        lineId,
        direction,
        code: "too_few_coordinates",
        message: `El recorrido ${direction} tiene menos de ${minimumCoordinateCount} puntos`
      });
      continue;
    }

    const cumulativeDistanceMeters = buildCumulativeDistanceMeters(path.coordinates);
    const totalDistanceMeters = cumulativeDistanceMeters[cumulativeDistanceMeters.length - 1] ?? 0;
    if (!Number.isFinite(totalDistanceMeters) || totalDistanceMeters <= 0) {
      diagnostics.push({
        lineId,
        direction,
        code: "invalid_distance",
        message: `El recorrido ${direction} no tiene distancia valida`
      });
      continue;
    }

    geometries.push({
      lineId,
      direction,
      coordinates: path.coordinates,
      cumulativeDistanceMeters,
      totalDistanceMeters,
      sourceHash,
      updatedAt
    });
  }

  return { lineId, sourceHash, geometries, diagnostics, updatedAt };
}

export function inferRouteDirection(name: string): RouteDirection | null {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (/^ida(\s|$)/.test(normalized)) return "ida";
  if (/^vuelta(\s|$)/.test(normalized)) return "vuelta";
  if (/^circular(\s|$)/.test(normalized)) return "circular";
  return null;
}

export function buildCumulativeDistanceMeters(coordinates: RouteCoordinate[]): number[] {
  if (coordinates.length === 0) return [];

  const cumulativeDistanceMeters = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    cumulativeDistanceMeters.push(
      cumulativeDistanceMeters[index - 1] +
        haversineDistanceMeters(previous.latitude, previous.longitude, current.latitude, current.longitude)
    );
  }
  return cumulativeDistanceMeters;
}

export function projectPointOntoRoute(
  latitude: number,
  longitude: number,
  geometry: RouteGeometry
): RouteProjection | null {
  if (geometry.coordinates.length < 2) return null;

  let bestProjection: RouteProjection | null = null;
  const referenceLatitude = latitude;

  // Project in a local meter plane: enough for city-scale routes and much cheaper than geodesic projection.
  for (let index = 0; index < geometry.coordinates.length - 1; index += 1) {
    const start = geometry.coordinates[index];
    const end = geometry.coordinates[index + 1];
    const startPoint = toLocalMeters(start.latitude, start.longitude, referenceLatitude);
    const endPoint = toLocalMeters(end.latitude, end.longitude, referenceLatitude);
    const targetPoint = toLocalMeters(latitude, longitude, referenceLatitude);
    const segmentX = endPoint.x - startPoint.x;
    const segmentY = endPoint.y - startPoint.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (segmentLengthSquared === 0) continue;

    const rawT =
      ((targetPoint.x - startPoint.x) * segmentX + (targetPoint.y - startPoint.y) * segmentY) /
      segmentLengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projectedPoint = {
      x: startPoint.x + t * segmentX,
      y: startPoint.y + t * segmentY
    };
    const distanceFromRouteMeters = Math.hypot(targetPoint.x - projectedPoint.x, targetPoint.y - projectedPoint.y);
    const segmentDistanceMeters = haversineDistanceMeters(start.latitude, start.longitude, end.latitude, end.longitude);
    const projectedCoordinate = fromLocalMeters(projectedPoint.x, projectedPoint.y, referenceLatitude);
    const projection = {
      distanceAlongRouteMeters: geometry.cumulativeDistanceMeters[index] + segmentDistanceMeters * t,
      distanceFromRouteMeters,
      segmentIndex: index,
      segmentCourse: bearingDegrees(start.latitude, start.longitude, end.latitude, end.longitude),
      projectedLatitude: projectedCoordinate.latitude,
      projectedLongitude: projectedCoordinate.longitude
    };

    if (!bestProjection || projection.distanceFromRouteMeters < bestProjection.distanceFromRouteMeters) {
      bestProjection = projection;
    }
  }

  return bestProjection;
}

export function haversineDistanceMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
) {
  const latitude1 = toRadians(startLatitude);
  const latitude2 = toRadians(endLatitude);
  const deltaLatitude = toRadians(endLatitude - startLatitude);
  const deltaLongitude = toRadians(endLongitude - startLongitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseKmlLineStringPaths(kml: string): KmlPath[] {
  const placemarkMatches = kml.matchAll(/<Placemark[\s\S]*?<\/Placemark>/gi);
  return Array.from(placemarkMatches)
    .filter((match) => /<LineString[\s\S]*?<\/LineString>/i.test(match[0]))
    .map((match) => ({
      name: readTagText(match[0], "name"),
      coordinates: parseCoordinates(readTagText(match[0], "coordinates"))
    }))
    .filter((path) => path.coordinates.length > 0);
}

function readTagText(value: string, tagName: string) {
  const match = value.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeXmlText(match?.[1] ?? "");
}

function parseCoordinates(value: string): RouteCoordinate[] {
  return value
    .trim()
    .split(/\s+/)
    .map((coordinate) => {
      const [longitude, latitude] = coordinate.split(",").map(Number);
      return { latitude, longitude };
    })
    .filter((coordinate) => Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude));
}

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function toLocalMeters(latitude: number, longitude: number, referenceLatitude: number) {
  const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(toRadians(referenceLatitude));
  return {
    x: longitude * metersPerDegreeLongitude,
    y: latitude * metersPerDegreeLatitude
  };
}

function fromLocalMeters(x: number, y: number, referenceLatitude: number): RouteCoordinate {
  const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos(toRadians(referenceLatitude));
  return {
    latitude: y / metersPerDegreeLatitude,
    longitude: x / metersPerDegreeLongitude
  };
}

function bearingDegrees(startLatitude: number, startLongitude: number, endLatitude: number, endLongitude: number) {
  const latitude1 = toRadians(startLatitude);
  const latitude2 = toRadians(endLatitude);
  const deltaLongitude = toRadians(endLongitude - startLongitude);
  const y = Math.sin(deltaLongitude) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

async function writeRouteGeometryBundle(bundle: RouteGeometryBundle) {
  memoryCache.set(bundle.lineId, bundle);
  if (!isRedisConfigured()) return;
  await redisCommand(["SET", routeGeometryRedisKey(bundle.lineId), JSON.stringify(bundle)]).catch(() => undefined);
}

function routeGeometryRedisKey(lineId: string) {
  return `${routeGeometryRedisKeyPrefix}:${lineId}`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function logRouteGeometry(
  event: string,
  metadata: {
    lineId?: string;
    direction?: RouteDirection;
    durationMs?: number;
    coordinateCount?: number;
    totalDistanceMeters?: number;
  } = {}
) {
  console.info(event, metadata);
}
