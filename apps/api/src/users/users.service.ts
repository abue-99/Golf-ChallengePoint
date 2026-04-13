import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
        role: { not: 'SYSADMIN' },
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

  /** Create a new PLAYER and assign them to a club and coach. */
  async invitePlayer(dto: {
    firstName: string;
    lastName: string;
    email: string;
    clubId: string;
    coachId: string;
  }) {
    const email = dto.email.toLowerCase();

    // Re-use existing user record if the email is already registered
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const tempPassword = crypto.randomBytes(9).toString('base64').slice(0, 12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'PLAYER',
        },
      });

      // Log invite info (no mail service configured yet)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      console.log(
        `[INVITE] New player ${email} created. ` +
          `Temp password: ${tempPassword}. ` +
          `Login link: ${appUrl}/login`,
      );
    }

    // Assign to club
    await this.prisma.userClub.upsert({
      where: { userId_clubId: { userId: user.id, clubId: dto.clubId } },
      update: {},
      create: { userId: user.id, clubId: dto.clubId },
    });

    // Link to coach
    const existingLink = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId: dto.coachId, playerId: user.id },
    });
    if (!existingLink) {
      await this.prisma.coachPlayerLink.create({
        data: { coachId: dto.coachId, playerId: user.id },
      });
    }

    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: this.userSelect,
    });
  }

  /** Coaches (COACH role) who share at least one club with the given user. */
  async getCoachesForUser(userId: string) {
    const userClubs = await this.prisma.userClub.findMany({
      where: { userId },
      select: { clubId: true },
    });
    const clubIds = userClubs.map((uc) => uc.clubId);
    if (clubIds.length === 0) return [];

    const coachUserClubs = await this.prisma.userClub.findMany({
      where: {
        clubId: { in: clubIds },
        user: { role: 'COACH' },
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            email: true,
            userClubs: {
              select: {
                clubId: true,
                club: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      distinct: ['userId'],
    });

    return coachUserClubs.map((uc) => uc.user);
  }

  /** Coaches currently linked to the given player. */
  async getPlayerCoaches(playerId: string) {
    const links = await this.prisma.coachPlayerLink.findMany({
      where: { playerId },
      select: {
        coachId: true,
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            email: true,
          },
        },
      },
    });
    return links.map((l) => l.coach);
  }

  async addPlayerCoach(playerId: string, coachId: string) {
    const existing = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
    });
    if (!existing) {
      await this.prisma.coachPlayerLink.create({ data: { coachId, playerId } });
    }
    return this.getPlayerCoaches(playerId);
  }

  async removePlayerCoach(playerId: string, coachId: string) {
    await this.prisma.coachPlayerLink.deleteMany({ where: { coachId, playerId } });
    return this.getPlayerCoaches(playerId);
  }
}
