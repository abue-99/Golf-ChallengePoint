import { NextRequest, NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clubId, ...signupPayload } = body;

    const apiUrl = process.env.API_URL || "http://golf_api:4000";

    // Always sign up as PLAYER — role selection is removed from the sign-up form.
    const res = await fetch(`${apiUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signupPayload, role: "PLAYER" }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // If the user selected a club, join it immediately using the fresh access token.
    if (clubId && data.accessToken) {
      const clubRes = await fetch(`${apiUrl}/clubs/my`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.accessToken}`,
        },
        body: JSON.stringify({ clubId }),
      }).catch((err) => {
        console.error("Club join error after signup:", err);
        return null;
      });
      if (clubRes && !clubRes.ok) {
        console.error(`Club join failed after signup: ${clubRes.status} ${clubRes.statusText}`);
      }
    }

    const secure = process.env.SECURE_COOKIES === "true";

    const response = NextResponse.json(data);
    response.cookies.set("token", data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 15 * 60,
    });

    // Forward the refresh_token cookie from the API to the browser.
    forwardRefreshTokenCookie(res, response, secure);

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}