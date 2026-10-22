import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { escapeHtml } from '../common/html';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 3;

/** Only the SHA-256 hash of a reset token is stored in the database. */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
  /** Simple per-email in-memory rate limit (single API instance). */
  private readonly recentRequests = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  private isRateLimited(email: string): boolean {
    const now = Date.now();
    const recent = (this.recentRequests.get(email) ?? []).filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
      this.recentRequests.set(email, recent);
      return true;
    }
    recent.push(now);
    this.recentRequests.set(email, recent);
    return false;
  }

  /**
   * Creates a reset token and emails the link. Always resolves without
   * revealing whether the account exists.
   */
  async requestReset(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    if (this.isRateLimited(email)) {
      this.logger.warn('Password reset rate limit hit');
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.$transaction(async (tx) => {
      // Only the newest link stays valid.
      await tx.passwordResetToken.deleteMany({ where: { email } });
      await tx.passwordResetToken.create({
        data: {
          email,
          token: hashResetToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      });
    });

    const appUrl =
      process.env.APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set – password reset email was not sent.',
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ??
          'noreply@contact.golf-challengepoint.com',
        to: email,
        subject: 'Reset your Golf Challenge Point password',
        html: `
          <p>Hi ${escapeHtml(user.firstName ?? 'there')},</p>
          <p>We received a request to reset your password for your Golf Challenge Point account.</p>
          <p>Click the link below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          <p>– The Golf Challenge Point team</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email: ${String(err)}`);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashResetToken(token) },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: record.email },
    });
    if (!user) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { email: record.email },
      });
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.passwordResetToken.deleteMany({
        where: { email: record.email },
      });
    });
  }
}
