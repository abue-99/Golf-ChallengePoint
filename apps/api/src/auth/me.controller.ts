import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class MeController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Request() req) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    return user;
  }
}
