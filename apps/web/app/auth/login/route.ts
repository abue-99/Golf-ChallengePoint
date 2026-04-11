import { NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const apiUrl = process.env.API_URL || "http://golf_api:4000";

  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    const secure = process.env.SECURE_COOKIES === "true";

    const res = NextResponse.json(data);
    res.cookies.set("token", data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 15 * 60,
    });

    // Forward the refresh_token cookie so the browser can use it to silently
    // renew access tokens after the 15-minute access token expires.
    forwardRefreshTokenCookie(response, res, secure);

    return res;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
