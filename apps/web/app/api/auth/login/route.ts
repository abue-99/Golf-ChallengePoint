import { NextRequest, NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apiUrl = process.env.API_URL || "http://golf_api:4000";
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const secure = process.env.SECURE_COOKIES === "true";

    const response = NextResponse.json(data);
    response.cookies.set("token", data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 15 * 60,
    });

    // Forward the refresh_token cookie that the API set on the server-side
    // response so the browser can use it to obtain new access tokens.
    forwardRefreshTokenCookie(res, response, secure);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}