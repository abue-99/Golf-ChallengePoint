import { verifyJwt } from "@/lib/jwt";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const payload = token ? verifyJwt<{ sub: string }>(token) : null;

  if (!payload) return NextResponse.json({ user: null });

  const apiUrl = process.env.API_URL || "http://golf_api:4000";

  try {
    const response = await fetch(`${apiUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return NextResponse.json({ user: null });
    const user = await response.json();
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
