import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { lineRoutes } from "@/app/data/lineRoutes";
import { readLineStops, writeLineStops, type LineStop, type LineStopDirection } from "@/app/data/lineStops";

export const dynamic = "force-dynamic";

export async function GET() {
  const stops = enrichStops(await readLineStops());

  return NextResponse.json({
    stops,
    total: stops.length,
    updatedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<LineStop>;
    const stop = normalizeStop(payload);
    const stops = await readLineStops();
    const nextStops = [...stops, stop].sort(compareStops);
    await writeLineStops(nextStops);

    return NextResponse.json({
      stop: enrichStops([stop])[0],
      stops: enrichStops(nextStops),
      total: nextStops.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la parada" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as { updates?: Array<{ id?: string; order?: unknown }> };
    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    const orderById = new Map<string, number | undefined>();

    for (const update of updates) {
      const id = update.id?.trim();
      if (!id) continue;
      const order = update.order == null || Number(update.order) <= 0 ? undefined : Math.round(Number(update.order));
      orderById.set(id, order);
    }

    if (orderById.size === 0) {
      return NextResponse.json({ error: "No hay paradas para actualizar" }, { status: 400 });
    }

    const stops = await readLineStops();
    const nextStops = stops
      .map((stop) => (orderById.has(stop.id) ? { ...stop, order: orderById.get(stop.id) } : stop))
      .sort(compareStops);
    await writeLineStops(nextStops);

    return NextResponse.json({
      stops: enrichStops(nextStops),
      total: nextStops.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron actualizar las paradas" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Falta id de parada" }, { status: 400 });
  }

  const stops = await readLineStops();
  const nextStops = stops.filter((stop) => stop.id !== id);
  await writeLineStops(nextStops);

  return NextResponse.json({
    stops: enrichStops(nextStops),
    total: nextStops.length,
    updatedAt: new Date().toISOString()
  });
}

function enrichStops(stops: LineStop[]) {
  return stops.map((stop) => {
    const line = lineRoutes.find((route) => route.id === stop.lineId);

    return {
      ...stop,
      lineNumber: line?.number ?? "",
      lineName: line?.name ?? "",
      color: line?.color ?? "#4b5563"
    };
  });
}

function normalizeStop(payload: Partial<LineStop>): LineStop {
  const lineId = payload.lineId?.trim();
  const line = lineRoutes.find((route) => route.id === lineId);
  const name = payload.name?.trim();
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const direction = normalizeDirection(payload.direction);
  const order = payload.order == null || Number(payload.order) <= 0 ? undefined : Math.round(Number(payload.order));

  if (!line) throw new Error("Linea no encontrada");
  if (!name) throw new Error("Falta nombre de parada");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Coordenadas invalidas");

  return {
    id: payload.id?.trim() || `${line.id}-${randomUUID().slice(0, 8)}`,
    lineId: line.id,
    name,
    latitude,
    longitude,
    direction,
    order
  };
}

function normalizeDirection(value: unknown): LineStopDirection {
  if (value === "ida" || value === "vuelta" || value === "ambos") return value;
  return "ambos";
}

function compareStops(a: LineStop, b: LineStop) {
  return a.lineId.localeCompare(b.lineId) || (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
}
