import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES === "true",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
