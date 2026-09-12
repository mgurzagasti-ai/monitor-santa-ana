import { NextResponse } from "next/server";
import { fetchTraccarDevices } from "@/app/api/traccar";
import { invalidateFleetCache } from "@/app/data/fleet";
import { readAssignments, removeAssignmentsByDeviceIds } from "@/app/data/assignments";

export const dynamic = "force-dynamic";

const orphanDeviceIds = [17752, 18310, 18323, 18325, 18327, 18429];

export async function POST() {
  try {
    const traccarDevices = await fetchTraccarDevices();
    const traccarDeviceIds = new Set(traccarDevices.map((device) => device.id));
    const existingDeviceIds = orphanDeviceIds.filter((deviceId) => traccarDeviceIds.has(deviceId));

    if (existingDeviceIds.length > 0) {
      return NextResponse.json(
        {
          error: "Limpieza abortada: uno o mas deviceId existen actualmente en Traccar.",
          existingDeviceIds,
          totalBefore: null,
          removed: 0,
          removedDeviceIds: [],
          totalAfter: null
        },
        { status: 409 }
      );
    }

    const assignments = await readAssignments();
    const totalBefore = assignments.length;
    const presentOrphanIds = orphanDeviceIds.filter((deviceId) =>
      assignments.some((assignment) => assignment.deviceId === deviceId)
    );

    const { assignments: nextAssignments, removedAssignments } = await removeAssignmentsByDeviceIds(orphanDeviceIds);
    await invalidateFleetCache();

    return NextResponse.json({
      totalBefore,
      removed: removedAssignments.length,
      removedDeviceIds: presentOrphanIds,
      totalAfter: nextAssignments.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}