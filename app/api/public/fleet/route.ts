import { NextRequest, NextResponse } from "next/server";
import { getFleetSnapshot } from "@/app/data/fleet";
import { checkRateLimit } from "@/app/data/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (clientIp) {
      const rateLimit = await checkRateLimit(clientIp, "fleet", {
        limit: 60000,
        windowSeconds: 60
      });
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too Many Requests" },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds),
              "Cache-Control": "private, no-store"
            }
          }
        );
      }
    }

    const snapshot = await getFleetSnapshot();
    return NextResponse.json({
      ...snapshot,
      vehicles: snapshot.vehicles.filter((vehicle) => (vehicle.operationalStatus ?? "EN_SERVICIO") === "EN_SERVICIO")
    }, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "public, s-maxage=5, stale-while-revalidate=25"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { vehicles: [], updatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store"
        }
      }
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

  return ip || null;
}
