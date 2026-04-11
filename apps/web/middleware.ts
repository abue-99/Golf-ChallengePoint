import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  const token = req.cookies.get("token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;

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

  // Auth pages (login, signup, etc.): redirect already-authenticated users to dashboard
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
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

  // If protected and no token, attempt a silent refresh before redirecting to login.
  // This prevents users from being kicked out every 15 minutes when they still
  // have a valid 7-day refresh token.
  if (isProtected && !token) {
    if (refreshToken) {
      try {
        const refreshRes = await fetch(
          new URL("/api/auth/refresh", req.url).toString(),
          {
            method: "POST",
            headers: { Cookie: req.headers.get("cookie") ?? "" },
          }
        );
        if (refreshRes.ok) {
          // Forward the Set-Cookie headers (new token + rotated refresh token)
          // from the refresh response so the browser receives the updated cookies.
          const res = NextResponse.next();
          const setCookie = refreshRes.headers.get("set-cookie");
          if (setCookie) {
            res.headers.set("set-cookie", setCookie);
          }
          return res;
        }
      } catch {
        // Network or parse error — fall through to the login redirect below.
      }
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
