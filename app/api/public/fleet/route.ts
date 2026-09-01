import { NextRequest, NextResponse } from "next/server";
import { getFleetSnapshot } from "@/app/data/fleet";
import { checkRateLimit } from "@/app/data/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(getClientIp(request), "fleet");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    return NextResponse.json(await getFleetSnapshot());
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}

function getClientIp(request: NextRequest) {
  const headerValue =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  const ip = headerValue.split(",")[0]?.trim();

  return ip || "unknown";
}
