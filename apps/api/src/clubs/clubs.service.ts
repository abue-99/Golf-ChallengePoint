import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ClubDto {
  shortId?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
}

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.club.findMany({ orderBy: { name: 'asc' } });
  }

  async createClub(dto: ClubDto) {
    if (dto.shortId) {
      const byShortId = await this.prisma.club.findFirst({
        where: { shortId: dto.shortId },
      });
      if (byShortId)
        throw new ConflictException(`Short ID "${dto.shortId}" is already in use.`);
    }
    const byName = await this.prisma.club.findFirst({ where: { name: dto.name } });
    if (byName)
      throw new ConflictException(`A club named "${dto.name}" already exists.`);

    return this.prisma.club.create({
      data: {
        shortId: dto.shortId ?? null,
        name: dto.name,
        city: dto.city ?? null,
        country: dto.country ?? null,
      },
    });
  }

  async updateClub(id: string, dto: Partial<ClubDto>) {
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException('Club not found.');

    if (dto.name !== undefined && dto.name !== club.name) {
      const conflict = await this.prisma.club.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (conflict)
        throw new ConflictException(`A club named "${dto.name}" already exists.`);
    }

    if (dto.shortId !== undefined && dto.shortId !== club.shortId) {
      if (dto.shortId) {
        const conflict = await this.prisma.club.findFirst({
          where: { shortId: dto.shortId, NOT: { id } },
        });
        if (conflict)
          throw new ConflictException(`Short ID "${dto.shortId}" is already in use.`);
      }
    }

    return this.prisma.club.update({
      where: { id },
      data: {
        ...(dto.shortId !== undefined ? { shortId: dto.shortId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
      },
    });
  }

  async deleteClub(id: string) {
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException('Club not found.');
    await this.prisma.club.delete({ where: { id } });
    return { success: true };
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
