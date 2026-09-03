import { NextRequest, NextResponse } from "next/server";
import { normalizeOperationalStatus, type OperationalStatus } from "@/app/data/assignments";
import { lineRoutes } from "@/app/data/lineRoutes";
import { fetchPositions, type TraccarPosition } from "@/app/api/traccar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const devices = parseDevices(request.nextUrl.searchParams.get("devices"));
    if (devices.length === 0) {
      return NextResponse.json({ vehicles: [], updatedAt: new Date().toISOString(), source: "empty" });
    }

    const positions = await fetchPositions("/api/positions");
    const vehicles = devices
      .map((device) => {
        const position = latestPositionForDevice(positions, device.deviceId);
        if (!position) return null;
        const assignedLine = lineRoutes.find((line) => line.id === device.assignedLineId);
        const label = `Colectivo ${device.internalNumber}`;

        return {
          id: device.deviceId,
          deviceId: device.deviceId,
          internalNumber: device.internalNumber,
          assignedLineId: assignedLine?.id ?? device.assignedLineId,
          assignedLineName: assignedLine?.name ?? "",
          operationalStatus: device.operationalStatus,
          label,
          line: assignedLine?.number ?? "-",
          color: assignedLine?.color ?? "#f57c00",
          latitude: position.latitude,
          longitude: position.longitude,
          speedKmh: position.speedKmh,
          course: position.course,
          fixTime: position.fixTime,
          gps: gpsDiagnostics(position)
        };
      })
      .filter(Boolean);

    return NextResponse.json({ vehicles, updatedAt: new Date().toISOString(), source: "monitor" });
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

type MonitorDevice = {
  deviceId: number;
  internalNumber: string;
  assignedLineId: string;
  operationalStatus: OperationalStatus;
};

function parseDevices(value: string | null): MonitorDevice[] {
  if (!value) return [];
  try {
    const rows = JSON.parse(value) as MonitorDevice[];
    return Array.isArray(rows)
      ? rows
          .filter((row) => Number.isFinite(Number(row.deviceId)) && row.internalNumber && row.assignedLineId)
          .map((row) => ({ ...row, operationalStatus: normalizeOperationalStatus(row.operationalStatus) }))
      : [];
  } catch {
    return [];
  }
}

function latestPositionForDevice(positions: TraccarPosition[], deviceId: number) {
  return positions
    .filter((position) => position.deviceId === deviceId)
    .sort((a, b) => b.fixTime.localeCompare(a.fixTime))[0];
}

function gpsDiagnostics(position: TraccarPosition) {
  const ageMs = Date.now() - new Date(position.fixTime).getTime();
  const ageSeconds = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null;
  const isFresh = ageSeconds === null ? false : ageSeconds <= 120;
  const isMoving = position.motion === true || position.speedKmh >= 3 || (position.distance ?? 0) > 0;
  const problems = [
    position.valid ? null : "GPS invalido",
    isFresh ? null : "Posicion vieja",
    isMoving ? null : "Sin movimiento",
    position.ignition === false ? "Ignicion apagada" : null,
    position.power === 0 ? "Sin alimentacion externa" : null
  ].filter(Boolean);

  return {
    status: problems.length > 0 ? problems.join(" | ") : "GPS activo",
    valid: position.valid,
    fresh: isFresh,
    moving: isMoving,
    motion: position.motion,
    ignition: position.ignition,
    power: position.power,
    battery: position.battery,
    satellites: position.satellites,
    distance: position.distance,
    ageSeconds,
  };
}
