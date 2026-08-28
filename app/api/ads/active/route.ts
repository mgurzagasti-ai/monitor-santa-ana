import { NextRequest, NextResponse } from "next/server";
import { getActiveAds, normalizePlacement } from "@/app/data/advertising";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const placement = normalizePlacement(request.nextUrl.searchParams.get("placement"));
    if (!placement) {
      return NextResponse.json({ hasAds: false, ads: [], error: "placement invalido" }, { status: 400 });
    }

    const ads = await getActiveAds(placement);
    return NextResponse.json({
      hasAds: ads.length > 0,
      ads,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { hasAds: false, ads: [], error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
