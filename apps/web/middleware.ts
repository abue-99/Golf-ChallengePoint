import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Pages that are reachable without a session. */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot",
  "/auth/reset",
];

/**
 * Refresh slightly before the access token actually expires so that a
 * request never reaches the API with a token that dies mid-flight.
 */
const EXPIRY_LEEWAY_SECONDS = 30;

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Static files from /public (logos, icons, uploads, …). */
function isStaticAsset(path: string) {
  return /\.[a-zA-Z0-9]+$/.test(path);
}

/**
 * Reads the `exp` claim without verifying the signature. Only used to decide
 * whether a refresh is needed; the API still verifies every token.
 */
function isTokenExpiring(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (typeof json.exp !== "number") return false;
    return json.exp - EXPIRY_LEEWAY_SECONDS <= Date.now() / 1000;
  } catch {
    return true;
  }
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const equalsIndex = part.indexOf("=");
    if (equalsIndex === -1) continue;
    result[part.slice(0, equalsIndex).trim()] = part.slice(equalsIndex + 1);
  }
  return result;
}

/**
 * Uses the refresh token to obtain a new access token. Returns the Set-Cookie
 * headers for the browser plus request headers in which the new cookies are
 * already visible, so Server Components and API route handlers of THIS request
 * see the fresh token (not only the next request).
 */
async function refreshSession(req: NextRequest) {
  try {
    const refreshRes = await fetch(
      new URL("/api/auth/refresh", req.url).toString(),
      {
        method: "POST",
        headers: { Cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      },
    );
    if (!refreshRes.ok) return null;

    const setCookies = refreshRes.headers.getSetCookie();
    const parsedNew: Record<string, string> = {};
    for (const raw of setCookies) {
      const cookieMatch = raw.match(/^([^=]+)=([^;]*)/);
      if (cookieMatch) parsedNew[cookieMatch[1].trim()] = cookieMatch[2];
    }
    if (!parsedNew.token) return null;

    const merged = { ...parseCookieHeader(req.headers.get("cookie")), ...parsedNew };
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(
      "cookie",
      Object.entries(merged)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );

    return { setCookies, requestHeaders };
  } catch {
    // Network or parse error — caller decides what to do.
    return null;
  }
}

function withCookies(res: NextResponse, setCookies: string[]) {
  for (const cookie of setCookies) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const token = req.cookies.get("token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const hasValidToken = Boolean(token) && !isTokenExpiring(token as string);
  const needsRefresh = !hasValidToken && Boolean(refreshToken);

  // Auth endpoints manage their own cookies.
  if (path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // API routes: refresh silently so EVERY proxy route (not only the ones
  // using proxyJsonWithAuthRetry) keeps working after the 15-minute access
  // token lifetime. If the refresh fails, the route answers 401 itself.
  if (path.startsWith("/api/")) {
    if (needsRefresh) {
      const refreshed = await refreshSession(req);
      if (refreshed) {
        return withCookies(
          NextResponse.next({ request: { headers: refreshed.requestHeaders } }),
          refreshed.setCookies,
        );
      }
    }
    return NextResponse.next();
  }

  if (isStaticAsset(path)) {
    return NextResponse.next();
  }

  // Auth pages (login, signup, etc.): redirect already-authenticated users to dashboard
  if (isPublicPath(path)) {
    if (hasValidToken) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Root path: send users with a session to the dashboard.
  if (path === "/") {
    if (hasValidToken) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (needsRefresh) {
      const refreshed = await refreshSession(req);
      if (refreshed) {
        return withCookies(
          NextResponse.redirect(new URL("/dashboard", req.url)),
          refreshed.setCookies,
        );
      }
    }
    return NextResponse.next();
  }

  // Every other page belongs to the app and requires a session. Protecting by
  // default (instead of a hand-maintained list) ensures new pages such as
  // /teams or /training-windows also get the silent refresh.
  if (hasValidToken) {
    return NextResponse.next();
  }

  if (refreshToken) {
    const refreshed = await refreshSession(req);
    if (refreshed) {
      return withCookies(
        NextResponse.next({ request: { headers: refreshed.requestHeaders } }),
        refreshed.setCookies,
      );
    }
  }

  const loginUrl = new URL("/login", req.url);
  const res = NextResponse.redirect(loginUrl);
  // Drop stale cookies so the login page is not bounced back to /dashboard.
  if (token) res.cookies.set("token", "", { maxAge: 0, path: "/" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
