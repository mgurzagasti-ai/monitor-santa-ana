import { NextResponse } from "next/server";
import { readAssignments } from "@/app/data/assignments";
import { lineRoutes } from "@/app/data/lineRoutes";
import { fetchPositions, getConfig } from "../traccar";

export async function GET() {
  try {
    const config = getConfig();
    const assignments = readAssignments();
    const positions = await fetchPositions("/api/positions");
    const vehicles = (
      await Promise.all(
        config.devices.map(async (device) => {
          const position = latestPositionForDevice(positions, device.id) ?? (await fetchLatestPosition(device.id));
          if (!position) return null;
          const assignment = assignments.find((row) => row.deviceId === device.id);
          const assignedLine = lineRoutes.find((line) => line.id === assignment?.assignedLineId);
          const diagnostics = gpsDiagnostics(position);

          return {
            ...device,
            deviceId: device.id,
            internalNumber: assignment?.internalNumber ?? "",
            assignedLineId: assignedLine?.id ?? assignment?.assignedLineId ?? "",
            assignedLineName: assignedLine?.name ?? "",
            label: assignment?.label || device.label,
            line: assignedLine?.number ?? device.line,
            color: assignedLine?.color ?? device.color,
            latitude: position.latitude,
            longitude: position.longitude,
            speedKmh: position.speedKmh,
            course: position.course,
            fixTime: position.fixTime,
            gps: diagnostics
          };
        })
      )
    ).filter(Boolean);

    return NextResponse.json({ vehicles, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

async function fetchLatestPosition(deviceId: number) {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString()
  });

  const positions = await fetchPositions(`/api/positions?${params.toString()}`);
  return latestPositionForDevice(positions, deviceId);
}

function latestPositionForDevice(positions: Awaited<ReturnType<typeof fetchPositions>>, deviceId: number) {
  return positions
    .filter((position) => position.deviceId === deviceId)
    .sort((a, b) => b.fixTime.localeCompare(a.fixTime))[0];
}

function gpsDiagnostics(position: NonNullable<ReturnType<typeof latestPositionForDevice>>) {
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
    ageSeconds
  };
}
