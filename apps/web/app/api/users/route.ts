import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const res = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const body = await req.json();
  const { clubId, ...signupPayload } = body;

  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(signupPayload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // If a club was specified, assign it to the newly created user.
  // Use the admin's token since we have it available.
  if (clubId && data.user?.id) {
    const clubRes = await fetch(`${API_URL}/users/${data.user.id}/clubs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clubId }),
    }).catch((err) => { console.error("Club assignment error after user creation:", err); return null; });
    if (clubRes && !clubRes.ok) {
      console.error(`Club assignment failed after user creation: ${clubRes.status} ${clubRes.statusText}`);
    }
  }

  return NextResponse.json(data, { status: res.status });
}
