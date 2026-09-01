import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function GET(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const url = qs
    ? `${API_URL}/assignments/my?${qs}`
    : `${API_URL}/assignments/my`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/assignments GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/assignments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/assignments POST]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
