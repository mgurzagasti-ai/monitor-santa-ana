import { NextRequest, NextResponse } from "next/server";
import { getPublicAppVersion, savePublicAppVersion } from "@/app/data/appVersion";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ version: await getPublicAppVersion() });
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({ version: await savePublicAppVersion(await request.json()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la version" },
      { status: 400 }
    );
  }
}