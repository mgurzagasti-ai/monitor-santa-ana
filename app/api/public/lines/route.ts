import { NextResponse } from "next/server";
import { getFleetSnapshot } from "@/app/data/fleet";
import { lineRoutes } from "@/app/data/lineRoutes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fleet = await getFleetSnapshot();
    const activeCounts = new Map<string, number>();

    fleet.vehicles.forEach((vehicle) => {
      if (!vehicle.assignedLineId) return;
      activeCounts.set(vehicle.assignedLineId, (activeCounts.get(vehicle.assignedLineId) ?? 0) + 1);
    });

    const lines = lineRoutes.map((line) => {
      const activeBuses = activeCounts.get(line.id) ?? 0;
      return {
        id: line.id,
        number: line.number,
        name: line.name,
        color: line.color,
        activeBuses,
        status: activeBuses > 0 ? "ONLINE" : "OFFLINE"
      };
    });

    return NextResponse.json({ lines, updatedAt: fleet.updatedAt, source: fleet.source });
  } catch (error) {
    return NextResponse.json(
      { lines: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
