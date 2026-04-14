import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

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

  /** Send an invitation email to a newly created player via Resend. */
  private async sendInviteEmail({
    to,
    tempPassword,
    loginUrl,
    firstName,
  }: {
    to: string;
    tempPassword: string;
    loginUrl: string;
    firstName: string;
  }): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      this.logger.warn(
        `[INVITE] RESEND_API_KEY not set – skipping invite email to ${to}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: 'noreply@contact.golf-challengepoint.com',
        to,
        subject: 'Your Golf Challenge Point Invitation',
        html: `
          <p>Hello${firstName ? ` ${firstName}` : ''},</p>
          <p>You have been invited to <strong>Golf Challenge Point</strong>.</p>
          <p>Use the temporary password below to log in for the first time:</p>
          <p><strong>${tempPassword}</strong></p>
          <p><a href="${loginUrl}">Log in here: ${loginUrl}</a></p>
          <p>Please change your password after your first login.</p>
        `,
      });
      this.logger.log(`Invite email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${to}: ${err}`);
      throw err;
    }
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
      const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      let tempPassword = '';
      const bytes = crypto.randomBytes(14);
      for (const byte of bytes) {
        tempPassword += chars[byte % chars.length];
      }
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

      const appUrl =
        process.env.APP_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        'http://localhost:3000';
      const loginUrl = `${appUrl}/login`;

      this.logger.log(
        `[INVITE] New player ${email} created. Login link: ${loginUrl}`,
      );

      await this.sendInviteEmail({
        to: email,
        tempPassword,
        loginUrl,
        firstName: dto.firstName,
      });
    } else {
      this.logger.log(`User ${email} already exists, invite email not sent.`);
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

  /** Coaches and Admins who share at least one club with the given user. */
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
        user: { role: { in: ['COACH', 'ADMIN'] } },
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

    return coachUserClubs.map((uc) => uc.user).filter(Boolean);
  }

  /** Players currently linked to the given coach. */
  async getCoachPlayers(coachId: string) {
    const links = await this.prisma.coachPlayerLink.findMany({
      where: { coachId },
      select: {
        playerId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            email: true,
            phoneNumber: true,
            timezone: true,
            lastLogin: true,
            userClubs: {
              select: {
                clubId: true,
                club: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    return links.map((l) => l.player).filter(Boolean);
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
    return links.map((l) => l.coach).filter(Boolean);
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

  /** Link an existing player to the given coach. */
  async addPlayerToCoach(coachId: string, playerId: string) {
    await this.prisma.coachPlayerLink.upsert({
      where: { coachId_playerId: { coachId, playerId } },
      update: {},
      create: { coachId, playerId },
    });
    return this.getCoachPlayers(coachId);
  }

  async removePlayerCoach(playerId: string, coachId: string) {
    await this.prisma.coachPlayerLink.deleteMany({ where: { coachId, playerId } });
    return this.getPlayerCoaches(playerId);
  }

  /** Resend the invitation email to a user who has not yet logged in. */
  async resendInvite(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let tempPassword = '';
    const bytes = crypto.randomBytes(14);
    for (const byte of bytes) {
      tempPassword += chars[byte % chars.length];
    }
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    const appUrl =
      process.env.APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000';
    const loginUrl = `${appUrl}/login`;

    await this.sendInviteEmail({
      to: user.email,
      tempPassword,
      loginUrl,
      firstName: user.firstName ?? '',
    });

    return { success: true };
  }
}
