import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/", "/api/fleet", "/api/assignments", "/api/line-stops"];
const adsAdminPaths = ["/admin/ads", "/api/admin/ads"];
const appVersionAdminPaths = ["/admin/app-version", "/api/admin/app-version"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAppVersionAdmin = appVersionAdminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isAppVersionAdmin) {
    return requireBasicAuth(
      request,
      process.env.APP_VERSION_ADMIN_USER ?? "admin",
      process.env.APP_VERSION_ADMIN_PASSWORD ?? process.env.ADS_ADMIN_PASSWORD ?? process.env.MONITOR_OPERATOR_PASSWORD,
      "Colectivos Jujuy Version"
    );
  }

  const isAdsAdmin = adsAdminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isAdsAdmin) {
    return requireBasicAuth(
      request,
      process.env.ADS_ADMIN_USER,
      process.env.ADS_ADMIN_PASSWORD ?? process.env.MONITOR_OPERATOR_PASSWORD,
      "Santa Ana Publicidad"
    );
  }

  const password = process.env.MONITOR_OPERATOR_PASSWORD;
  if (!password) return NextResponse.next();

  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) return NextResponse.next();

  return requireBasicAuth(request, undefined, password, "Santa Ana Monitor");
}

function requireBasicAuth(request: NextRequest, username: string | undefined, password: string | undefined, realm: string) {
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    const submittedUsername = separator >= 0 ? decoded.slice(0, separator) : "";
    const submittedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
    const usernameMatches = !username || submittedUsername === username;
    if (usernameMatches && submittedPassword === password) return NextResponse.next();
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
