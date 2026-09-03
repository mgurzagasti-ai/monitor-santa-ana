import { NextRequest, NextResponse } from "next/server";
import {
  normalizeOperationalStatus,
  readAssignments,
  upsertAssignment,
  type VehicleAssignment
} from "@/app/data/assignments";
import { invalidateFleetCache } from "@/app/data/fleet";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ assignments: await readAssignments(), updatedAt: new Date().toISOString() });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<VehicleAssignment>;
    const deviceId = Number(body.deviceId);

    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      return NextResponse.json({ error: "deviceId invalido" }, { status: 400 });
    }

    const assignments = await readAssignments();
    const currentAssignment = assignments.find((assignment) => assignment.deviceId === deviceId);
    const internalNumber = String(body.internalNumber ?? currentAssignment?.internalNumber ?? "").trim();
    const assignedLineId = String(body.assignedLineId ?? currentAssignment?.assignedLineId ?? "").trim();
    const label = String(body.label ?? currentAssignment?.label ?? `Colectivo ${internalNumber}`).trim();
    const operationalStatus = body.operationalStatus === undefined
      ? currentAssignment?.operationalStatus ?? "EN_SERVICIO"
      : normalizeOperationalStatus(body.operationalStatus);

    if (!internalNumber) {
      return NextResponse.json({ error: "Falta interno" }, { status: 400 });
    }

    if (!assignedLineId) {
      return NextResponse.json({ error: "Falta linea asignada" }, { status: 400 });
    }

    const internalNumberChanged = !currentAssignment || !sameInternalNumber(currentAssignment.internalNumber, internalNumber);
    if (internalNumberChanged) {
      const duplicatedAssignment = assignments.find(
        (assignment) =>
          assignment.deviceId !== deviceId &&
          sameInternalNumber(assignment.internalNumber, internalNumber)
      );

      if (duplicatedAssignment) {
        return NextResponse.json(
          { error: `El interno ${internalNumber} ya esta asignado a ${duplicatedAssignment.label}` },
          { status: 409 }
        );
      }
    }

    const assignment = await upsertAssignment({
      deviceId,
      internalNumber,
      label,
      assignedLineId,
      operationalStatus
    });
    await invalidateFleetCache();

    return NextResponse.json({ assignment, assignments: await readAssignments(), updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

function sameInternalNumber(current: string, next: string) {
  return current.trim().toLowerCase() === next.trim().toLowerCase();
}