import { NextRequest, NextResponse } from "next/server";

const COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  secure: process.env.SECURE_COOKIES === "true",
  sameSite: "strict" as const,
  maxAge: 0,
  path: "/",
};

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", COOKIE_CLEAR_OPTIONS);
  return res;
}

// GET is used by server-component layouts to clear a stale/invalid token and
// redirect back to the login page, breaking the middleware ↔ layout redirect loop.
export async function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set("token", "", COOKIE_CLEAR_OPTIONS);
  return res;
}
