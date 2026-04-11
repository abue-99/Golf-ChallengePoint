import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

/**
 * Public (unauthenticated) endpoint that returns the list of clubs.
 * Used by the signup form so new users can pick their club without needing a token.
 * Proxies to the NestJS /clubs/public endpoint which requires no authentication.
 */
export async function GET() {
  try {
    const res = await fetch(`${API_URL}/clubs/public`, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
