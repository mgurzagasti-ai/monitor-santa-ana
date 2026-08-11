import { NextResponse } from "next/server";
import { lineRoutes } from "@/app/data/lineRoutes";
import { lineStops } from "@/app/data/lineStops";

export const dynamic = "force-static";

export async function GET() {
  const stops = lineStops.map((stop) => {
    const line = lineRoutes.find((route) => route.id === stop.lineId);

    return {
      ...stop,
      lineNumber: line?.number ?? "",
      lineName: line?.name ?? "",
      color: line?.color ?? "#4b5563"
    };
  });

  return NextResponse.json({
    stops,
    total: stops.length,
    updatedAt: new Date().toISOString()
  });
}
