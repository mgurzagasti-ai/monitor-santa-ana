import { NextResponse } from "next/server";
import { lineRoutes } from "@/app/data/lineRoutes";

export const revalidate = 3600;

type RoutePath = [number, number][];

export async function GET() {
  const routes = await Promise.all(
    lineRoutes.map(async (line) => {
      try {
        const response = await fetch(line.kmlUrl, { next: { revalidate } });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const kml = await response.text();
        return {
          id: line.id,
          number: line.number,
          name: line.name,
          color: line.color,
          mapUrl: line.mapUrl,
          paths: parseKmlPaths(kml)
        };
      } catch (error) {
        return {
          id: line.id,
          number: line.number,
          name: line.name,
          color: line.color,
          mapUrl: line.mapUrl,
          paths: [] as RoutePath[],
          error: error instanceof Error ? error.message : "Error"
        };
      }
    })
  );

  return NextResponse.json({
    routes,
    updatedAt: new Date().toISOString()
  });
}

function parseKmlPaths(kml: string): RoutePath[] {
  const matches = kml.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi);

  return Array.from(matches)
    .map((match) => parseCoordinates(match[1]))
    .filter((path) => path.length >= 2);
}

function parseCoordinates(value: string): RoutePath {
  return value
    .trim()
    .split(/\s+/)
    .map((coord) => {
      const [longitude, latitude] = coord.split(",").map(Number);
      return [latitude, longitude] as [number, number];
    })
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
}
