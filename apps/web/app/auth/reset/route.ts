import { prisma } from "@challengepoint/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { email: record.email },
    data: { passwordHash: hash },
  });

  await prisma.passwordResetToken.delete({
    where: { token },
  });

  return NextResponse.json({ ok: true });
}