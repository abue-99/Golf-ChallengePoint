import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  try {
    const res = await fetch(`${API_URL}/lessons/players`, {
      headers: { Authorization: 'Bearer ' + token },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ([]));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/lessons/players GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}
