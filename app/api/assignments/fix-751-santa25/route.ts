import { NextResponse } from "next/server";
import { fetchTraccarDevices } from "@/app/api/traccar";
import { invalidateFleetCache } from "@/app/data/fleet";
import { readAssignments, replaceAssignmentDeviceId } from "@/app/data/assignments";

export const dynamic = "force-dynamic";

const currentDeviceId = 10;
const targetDeviceId = 26;
const internalNumber = "751";
const expectedTotal = 54;

export async function POST() {
  try {
    const traccarDevices = await fetchTraccarDevices();
    const currentDevice = traccarDevices.find((device) => device.id === currentDeviceId);
    const targetDevice = traccarDevices.find((device) => device.id === targetDeviceId);

    if (currentDevice?.name !== "santa10" || targetDevice?.name !== "santa25") {
      return NextResponse.json(
        {
          error: "La verificacion de dispositivos Traccar no coincide",
          devices: {
            current: currentDevice
              ? { id: currentDevice.id, name: currentDevice.name, uniqueId: currentDevice.uniqueId }
              : null,
            target: targetDevice
              ? { id: targetDevice.id, name: targetDevice.name, uniqueId: targetDevice.uniqueId }
              : null
          }
        },
        { status: 409 }
      );
    }

    const assignments = await readAssignments();
    const totalBefore = assignments.length;
    const currentAssignment = assignments.find(
      (assignment) =>
        assignment.deviceId === currentDeviceId && assignment.internalNumber.trim() === internalNumber
    );
    const targetAssignment = assignments.find((assignment) => assignment.deviceId === targetDeviceId);

    if (totalBefore !== expectedTotal) {
      return NextResponse.json(
        {
          error: "El total de asignaciones no coincide con el esperado",
          totalBefore,
          expectedTotal
        },
        { status: 409 }
      );
    }

    if (!currentAssignment) {
      return NextResponse.json(
        {
          error: "No existe la asignacion esperada deviceId 10 -> interno 751",
          totalBefore
        },
        { status: 409 }
      );
    }

    if (targetAssignment) {
      return NextResponse.json(
        {
          error: "El deviceId 26 ya tiene una asignacion",
          totalBefore,
          targetAssignment
        },
        { status: 409 }
      );
    }

    const result = await replaceAssignmentDeviceId(currentDeviceId, targetDeviceId, internalNumber);
    const updatedAssignment = result.assignments.find(
      (assignment) =>
        assignment.deviceId === targetDeviceId && assignment.internalNumber.trim() === internalNumber
    );
    const staleAssignment = result.assignments.find(
      (assignment) =>
        assignment.deviceId === currentDeviceId && assignment.internalNumber.trim() === internalNumber
    );

    if (!updatedAssignment || staleAssignment || result.assignments.length !== totalBefore) {
      return NextResponse.json(
        {
          error: "La verificacion posterior no coincide",
          totalBefore,
          totalAfter: result.assignments.length,
          updated: Boolean(updatedAssignment),
          stale: Boolean(staleAssignment)
        },
        { status: 500 }
      );
    }

    await invalidateFleetCache();

    return NextResponse.json({
      totalBefore,
      totalAfter: result.assignments.length,
      updated: {
        fromDeviceId: currentDeviceId,
        toDeviceId: targetDeviceId,
        internalNumber: updatedAssignment.internalNumber,
        assignedLineId: updatedAssignment.assignedLineId,
        operationalStatus: updatedAssignment.operationalStatus
      },
      devices: {
        current: {
          id: currentDevice.id,
          name: currentDevice.name,
          uniqueId: currentDevice.uniqueId,
          status: currentDevice.status
        },
        target: {
          id: targetDevice.id,
          name: targetDevice.name,
          uniqueId: targetDevice.uniqueId,
          status: targetDevice.status
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
