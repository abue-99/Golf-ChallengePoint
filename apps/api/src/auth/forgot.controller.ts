import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resend } from '@/lib/email';
import crypto from 'crypto';

@Controller('auth')
export class ForgotController {
  constructor(private prisma: PrismaService) {}

  @Post('forgot')
  async forgot(@Body() { email }: { email: string }) {
    const token = crypto.randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: 'Reset your Golf Challenge Point password',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
      `,
    });

    return { ok: true };
  }
}
