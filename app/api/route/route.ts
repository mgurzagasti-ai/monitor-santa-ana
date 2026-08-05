import { NextRequest, NextResponse } from "next/server";
import { fetchPositions, getConfig } from "../traccar";

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const deviceId = Number(request.nextUrl.searchParams.get("deviceId") ?? config.devices[0]?.id ?? 0);
    const hours = Math.min(Number(request.nextUrl.searchParams.get("hours") ?? 6), 24);

    if (!deviceId) {
      return NextResponse.json({ points: [] });
    }

    const to = new Date();
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
    const params = new URLSearchParams({
      deviceId: String(deviceId),
      from: from.toISOString(),
      to: to.toISOString()
    });

    const points = (await fetchPositions(`/api/positions?${params.toString()}`))
      .filter((position) => position.deviceId === deviceId)
      .sort((a, b) => a.fixTime.localeCompare(b.fixTime));

    return NextResponse.json({ points, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { points: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
