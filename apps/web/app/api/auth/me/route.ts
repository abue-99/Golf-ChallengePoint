import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(null, { status: 401 });
  }

  const apiUrl = process.env.API_URL || "http://golf_api:4000";

  try {
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    const user = await res.json();
    return NextResponse.json(user);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
