import { NextResponse } from "next/server";
import { getFleetSnapshot } from "@/app/data/fleet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getFleetSnapshot());
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
