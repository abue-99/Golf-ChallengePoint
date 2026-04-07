import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  const token = req.cookies.get("token")?.value;

  const PUBLIC_PATHS = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot",
    "/auth/reset"
  ];

  // Public pages → no check
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Root path: redirect authenticated users to dashboard
  if (path === "/" && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protected routes
  const PROTECTED = [
    "/dashboard",
    "/player",
    "/coach",
    "/club",
    "/admin",
    "/settings"
  ];
  const isProtected = PROTECTED.some((p) => path.startsWith(p));

  // If protected and no token → redirect to login
  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
