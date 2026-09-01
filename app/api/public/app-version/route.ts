import { NextResponse } from "next/server";
import { getPublicAppVersion } from "@/app/data/appVersion";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPublicAppVersion());
}