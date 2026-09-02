import { NextRequest, NextResponse } from "next/server";
import { lineRoutes } from "@/app/data/lineRoutes";
import { readLineStops } from "@/app/data/lineStops";
import { getOrBuildRouteGeometryBundle } from "@/app/data/routeGeometry";
import { getOrBuildLineProjectionReadiness } from "@/app/data/stopProjections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lineId = request.nextUrl.searchParams.get("lineId")?.trim();
  const selectedLines = lineId ? lineRoutes.filter((line) => line.id === lineId) : lineRoutes;

  if (lineId && selectedLines.length === 0) {
    return NextResponse.json({ error: "Linea no encontrada" }, { status: 404 });
  }

  const stops = await readLineStops();
  const lines = await Promise.all(
    selectedLines.map(async (line) => {
      const geometryBundle = await getOrBuildRouteGeometryBundle(line);
      const readiness = await getOrBuildLineProjectionReadiness(line.id, stops, geometryBundle);

      return {
        lineId: line.id,
        number: line.number,
        name: line.name,
        lineGeometryReady: readiness.lineGeometryReady,
        geometries: geometryBundle.geometries.map((geometry) => ({
          direction: geometry.direction,
          geometryReady: geometry.coordinates.length >= 2 && geometry.totalDistanceMeters > 0,
          coordinateCount: geometry.coordinates.length,
          totalDistanceMeters: Math.round(geometry.totalDistanceMeters)
        })),
        geometryDiagnostics: geometryBundle.diagnostics,
        stopCount: readiness.stopCount,
        stopEtaReadyCount: readiness.stopEtaReadyCount,
        stops: readiness.projections.map((projection) => ({
          stopId: projection.stopId,
          direction: projection.direction,
          stopMeasureMeters: Math.round(projection.stopMeasureMeters),
          distanceFromRouteMeters: Number.isFinite(projection.distanceFromRouteMeters)
            ? Math.round(projection.distanceFromRouteMeters)
            : null,
          segmentIndex: projection.segmentIndex,
          projectionValid: projection.projectionValid,
          stopEtaReady: projection.stopEtaReady,
          diagnostics: projection.diagnostics
        })),
        orderDiagnostics: readiness.orderDiagnostics,
        updatedAt: readiness.calculatedAt
      };
    })
  );

  return NextResponse.json({
    lines,
    total: lines.length,
    updatedAt: new Date().toISOString()
  });
}
