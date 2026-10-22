import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

/**
 * Forwards password-reset requests to the API, which owns token creation,
 * rate limiting and email delivery. Always answers with ok so the response
 * never reveals whether an account exists.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch(`${API_URL}/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!res.ok && res.status !== 400) {
      console.error("[forgot] API responded with status", res.status);
    }
  } catch (err) {
    console.error("[forgot] Failed to reach API:", err);
  }

  return NextResponse.json({ ok: true });
}
