import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.club.findMany({ orderBy: { name: 'asc' } });
  }

  getUserClubs(userId: string) {
    return this.prisma.userClub.findMany({
      where: { userId },
      include: { club: true },
    });
  }

  async addUserClub(userId: string, clubId: string) {
    await this.prisma.userClub.upsert({
      where: { userId_clubId: { userId, clubId } },
      update: {},
      create: { userId, clubId },
    });
    return this.getUserClubs(userId);
  }

  async removeUserClub(userId: string, clubId: string) {
    await this.prisma.userClub.deleteMany({ where: { userId, clubId } });
    return this.getUserClubs(userId);
  }
}
