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
  try {
    const res = await fetch(`${API_URL}/development-plans/my-plans`, {
      headers: { Authorization: 'Bearer ' + token },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/development-plans/my-plans GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}
