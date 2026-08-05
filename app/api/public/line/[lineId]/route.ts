import { NextRequest, NextResponse } from "next/server";
import { getFleetSnapshot } from "@/app/data/fleet";
import { lineRoutes } from "@/app/data/lineRoutes";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ lineId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { lineId } = await params;
    const line = lineRoutes.find((row) => row.id === lineId || row.number.toLowerCase() === lineId.toLowerCase());

    if (!line) {
      return NextResponse.json({ error: "Linea no encontrada" }, { status: 404 });
    }

    const fleet = await getFleetSnapshot();
    const vehicles = fleet.vehicles.filter((vehicle) => vehicle.assignedLineId === line.id);

    return NextResponse.json({
      line: {
        id: line.id,
        number: line.number,
        name: line.name,
        color: line.color,
        activeBuses: vehicles.length,
        status: vehicles.length > 0 ? "ONLINE" : "OFFLINE"
      },
      vehicles,
      updatedAt: fleet.updatedAt,
      source: fleet.source
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
