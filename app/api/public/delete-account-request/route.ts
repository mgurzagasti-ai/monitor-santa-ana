import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/app/data/rateLimit";
import { createDeleteAccountRequest, hashEmail, isValidEmail, normalizeEmail } from "@/app/data/deleteAccountRequests";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown; confirmed?: unknown } | null;
    const email = normalizeEmail(String(body?.email ?? ""));
    const confirmed = body?.confirmed === true;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Ingresa un email valido." }, { status: 400 });
    }

    if (!confirmed) {
      return NextResponse.json({ error: "Debes confirmar la solicitud de eliminacion." }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipRateLimit = await checkRateLimit(clientIp, "delete-account-request-ip", {
        limit: 5,
        windowSeconds: 60 * 60,
        retryAfterSeconds: 60 * 60
      });
      if (!ipRateLimit.allowed) return rateLimitResponse(ipRateLimit.retryAfterSeconds);
    }

    const emailRateLimit = await checkRateLimit(hashEmail(email), "delete-account-request-email", {
      limit: 3,
      windowSeconds: 60 * 60,
      retryAfterSeconds: 60 * 60
    });
    if (!emailRateLimit.allowed) return rateLimitResponse(emailRateLimit.retryAfterSeconds);

    const deletionRequest = await createDeleteAccountRequest({
      email,
      userAgent: request.headers.get("user-agent") ?? ""
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        message: "Solicitud recibida. La eliminacion definitiva requiere verificacion de identidad."
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la solicitud." },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store"
        }
      }
    );
  }
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Intenta nuevamente mas tarde." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "private, no-store"
      }
    }
  );
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
