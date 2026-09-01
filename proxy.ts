import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/", "/api/fleet", "/api/assignments", "/api/line-stops"];
const adsAdminPaths = ["/admin/ads", "/api/admin/ads", "/admin/app-version", "/api/admin/app-version"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdsAdmin = adsAdminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isAdsAdmin) {
    return requirePassword(request, process.env.ADS_ADMIN_PASSWORD ?? process.env.MONITOR_OPERATOR_PASSWORD, "Santa Ana Publicidad");
  }

  const password = process.env.MONITOR_OPERATOR_PASSWORD;
  if (!password) return NextResponse.next();

  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) return NextResponse.next();

  return requirePassword(request, password, "Santa Ana Monitor");
}

function requirePassword(request: NextRequest, password: string | undefined, realm: string) {
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    const submittedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
    if (submittedPassword === password) return NextResponse.next();
  }

  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}"`
    }
  });
}

export const config = {
  matcher: [
    "/",
    "/api/fleet/:path*",
    "/api/assignments/:path*",
    "/api/line-stops/:path*",
    "/admin/ads",
    "/admin/ads/:path*",
    "/api/admin/ads",
    "/api/admin/ads/:path*",
    "/admin/app-version",
    "/admin/app-version/:path*",
    "/api/admin/app-version",
    "/api/admin/app-version/:path*"
  ]
};
