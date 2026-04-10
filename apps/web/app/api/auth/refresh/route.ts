import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forwardRefreshTokenCookie } from "@/lib/auth-cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const apiUrl = process.env.API_URL || "http://golf_api:4000";

  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
      credentials: "include",
    });

    if (!res.ok) {
      // Refresh token is invalid — clear both cookies so the user is
      // redirected to login on the next protected-page visit.
      const errResponse = NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
      errResponse.cookies.set("token", "", { maxAge: 0, path: "/" });
      errResponse.cookies.set("refresh_token", "", { maxAge: 0, path: "/" });
      return errResponse;
    }

    const data = await res.json();
    const secure = process.env.SECURE_COOKIES === "true";

    const response = NextResponse.json({ ok: true });
    response.cookies.set("token", data.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 15 * 60,
    });

    // Rotate the refresh token if the API returned a new one.
    forwardRefreshTokenCookie(res, response, secure);

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
