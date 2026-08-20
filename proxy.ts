import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/", "/api/fleet", "/api/assignments", "/api/line-stops"];

export function proxy(request: NextRequest) {
  const password = process.env.MONITOR_OPERATOR_PASSWORD;
  if (!password) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) return NextResponse.next();

  const auth = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    const submittedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
    if (submittedPassword === password) return NextResponse.next();
  }

  return new NextResponse("Acceso restringido al monitor", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Santa Ana Monitor"'
    }
  });
}

export const config = {
  matcher: ["/", "/api/fleet/:path*", "/api/assignments/:path*", "/api/line-stops/:path*"]
};
