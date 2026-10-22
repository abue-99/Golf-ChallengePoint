import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_URL}/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = Array.isArray(data?.message)
        ? data.message.join(" ")
        : data?.message || "Invalid or expired token";
      return NextResponse.json({ error: message }, { status: res.status === 400 ? 400 : 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
