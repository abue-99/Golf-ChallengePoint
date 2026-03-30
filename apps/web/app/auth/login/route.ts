import { NextResponse } from "next/server";
import { prisma } from "@golf/db";
import bcrypt from "bcrypt";
import { signJwt } from "@/lib/jwt";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  // Create token
  const token = signJwt({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({ token });
}