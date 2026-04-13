import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: true });
  }

  const normalised = email.toLowerCase().trim();

  // Always respond with ok to avoid leaking whether an account exists.
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { email: normalised, token, expiresAt },
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@golf-challengepoint.com",
    to: normalised,
    subject: "Reset your Golf Challenge Point password",
    html: `
      <p>Hi ${user.firstName ?? "there"},</p>
      <p>We received a request to reset your password for your Golf Challenge Point account.</p>
      <p>Click the link below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p>– The Golf Challenge Point team</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
