import { NextResponse } from "next/server";

/** Basic structural check: three base64url segments separated by dots. */
function isJwtShaped(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Reads the `refresh_token` value from the `Set-Cookie` header returned by the
 * internal API response and, if it looks like a valid JWT, sets it as an
 * httpOnly cookie on the outgoing browser response.
 */
export function forwardRefreshTokenCookie(
  apiRes: Response,
  browserRes: NextResponse,
  secure: boolean
): boolean {
  const setCookie = apiRes.headers.get("set-cookie");
  if (!setCookie) return false;

  const match = setCookie.match(/refresh_token=([^;]+)/);
  if (!match) return false;

  const value = match[1];
  if (!isJwtShaped(value)) return false;

  browserRes.cookies.set("refresh_token", value, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return true;
}
