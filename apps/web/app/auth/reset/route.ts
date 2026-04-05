import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  const apiUrl = process.env.API_URL || "http://golf_api:4000";

  try {
    const response = await fetch(`${apiUrl}/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
