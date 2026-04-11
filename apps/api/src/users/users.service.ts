import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    profileImage: true,
    role: true,
    createdAt: true,
    lastLogin: true,
    userClubs: {
      select: {
        clubId: true,
        club: { select: { id: true, name: true } },
      },
    },
  } as const;

  listAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: this.userSelect,
    });
  }

  async listForAdmin(adminId: string) {
    const adminClubs = await this.prisma.userClub.findMany({
      where: { userId: adminId },
      select: { clubId: true },
    });
    const clubIds = adminClubs.map((uc) => uc.clubId);
    if (clubIds.length === 0) return [];
    return this.prisma.user.findMany({
      where: {
        userClubs: { some: { clubId: { in: clubIds } } },
      },
      orderBy: { createdAt: 'asc' },
      select: this.userSelect,
    });
  }

  async updateRole(id: string, role: 'PLAYER' | 'COACH' | 'ADMIN' | 'SYSADMIN') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.userSelect,
    });
  }

  async addUserClub(userId: string, clubId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    await this.prisma.userClub.upsert({
      where: { userId_clubId: { userId, clubId } },
      update: {},
      create: { userId, clubId },
    });
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });
  }

  async removeUserClub(userId: string, clubId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    await this.prisma.userClub.deleteMany({ where: { userId, clubId } });
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect,
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
