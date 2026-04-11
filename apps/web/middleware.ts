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
          const newSetCookies = refreshRes.headers.getSetCookie();

          // Parse the new cookie values (name=value) from the Set-Cookie headers.
          const parsedNew: Record<string, string> = {};
          for (const raw of newSetCookies) {
            const cookieMatch = raw.match(/^([^=]+)=([^;]*)/);
            if (cookieMatch) parsedNew[cookieMatch[1].trim()] = cookieMatch[2];
          }

          // Merge the new cookies into the existing request cookie header so
          // that Server Components (e.g. the app layout) see the refreshed
          // access token for THIS request, not just the next one.
          const existing: Record<string, string> = {};
          for (const part of (req.headers.get("cookie") ?? "").split(";")) {
            const equalsIndex = part.indexOf("=");
            if (equalsIndex === -1) continue;
            existing[part.slice(0, equalsIndex).trim()] = part.slice(equalsIndex + 1);
          }
          const merged = { ...existing, ...parsedNew };
          const cookieHeader = Object.entries(merged)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

          const requestHeaders = new Headers(req.headers);
          requestHeaders.set("cookie", cookieHeader);

          // Continue with updated request headers (visible to Server Components)
          // and forward Set-Cookie to the browser so it persists the new cookies.
          const res = NextResponse.next({ request: { headers: requestHeaders } });
          for (const cookie of newSetCookies) {
            res.headers.append("set-cookie", cookie);
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
