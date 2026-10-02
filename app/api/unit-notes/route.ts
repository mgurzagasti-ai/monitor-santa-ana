import { NextRequest, NextResponse } from "next/server";
import { readUnitNotes, saveUnitNote } from "@/app/data/unitNotes";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ notes: await readUnitNotes(), updatedAt: new Date().toISOString() });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { internalNumber?: unknown; description?: unknown };
    const notes = await saveUnitNote(body.internalNumber, body.description);
    return NextResponse.json({ notes, updatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la novedad";
    const status = message === "Falta interno" || message.includes("1000 caracteres") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
