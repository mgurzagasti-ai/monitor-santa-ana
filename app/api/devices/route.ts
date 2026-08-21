import { NextRequest, NextResponse } from "next/server";
import { upsertAssignment } from "@/app/data/assignments";
import { upsertFleetDevice } from "@/app/data/fleetDevices";
import { invalidateFleetCache } from "@/app/data/fleet";
import { fetchTraccarDevices, getConfig } from "@/app/api/traccar";
import { lineRoutes } from "@/app/data/lineRoutes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const traccarDevices = await fetchTraccarDevices();
    return NextResponse.json({ devices: traccarDevices, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { devices: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      deviceId?: unknown;
      uniqueId?: unknown;
      name?: unknown;
      internalNumber?: unknown;
      assignedLineId?: unknown;
    };
    const deviceId = Number(body.deviceId);
    const uniqueId = String(body.uniqueId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const internalNumber = String(body.internalNumber ?? "").trim();
    const assignedLineId = String(body.assignedLineId ?? "").trim();
    const line = lineRoutes.find((row) => row.id === assignedLineId);

    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      return NextResponse.json({ error: "Falta seleccionar un GPS de Traccar" }, { status: 400 });
    }

    if (!internalNumber) {
      return NextResponse.json({ error: "Falta numero de interno" }, { status: 400 });
    }

    if (!line) {
      return NextResponse.json({ error: "Linea no encontrada" }, { status: 400 });
    }

    const config = getConfig();
    const label = `Colectivo ${internalNumber}`;
    const device = await upsertFleetDevice(
      {
        id: deviceId,
        uniqueId,
        line: line.number,
        label: name || label,
        color: line.color
      },
      config.devices
    );
    const assignment = await upsertAssignment({
      deviceId,
      internalNumber,
      label,
      assignedLineId: line.id
    });
    await invalidateFleetCache();

    return NextResponse.json({ device, assignment, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el GPS" },
      { status: 500 }
    );
  }
}
