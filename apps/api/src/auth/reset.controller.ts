import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class ResetController {
  constructor(private prisma: PrismaService) {}

  @Post('reset')
  async reset(@Body() { token, password }: { token: string; password: string }) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      return { error: 'Invalid or expired token' };
    }

    const hash = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { email: record.email },
      data: { passwordHash: hash },
    });

    await this.prisma.passwordResetToken.delete({
      where: { token },
    });

    return { ok: true };
  }
}
