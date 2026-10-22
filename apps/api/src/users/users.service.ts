import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { loadPlayerLearningSummaries } from '../assignments/assignment-lifecycle';
import { escapeHtml } from '../common/html';

export type UserManagementAction = 'role' | 'profile' | 'delete' | 'invite';

interface Caller {
  id: string;
  role: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  // Resend throws when constructed without a key, which would crash the API
  // on startup if RESEND_API_KEY is (intentionally) left empty.
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

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

  private async getClubIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.userClub.findMany({
      where: { userId },
      select: { clubId: true },
    });
    return memberships.map((m) => m.clubId);
  }

  /** True when both users are members of at least one common club. */
  async shareClub(userA: string, userB: string): Promise<boolean> {
    const clubIds = await this.getClubIds(userA);
    if (clubIds.length === 0) return false;
    const match = await this.prisma.userClub.findFirst({
      where: { userId: userB, clubId: { in: clubIds } },
      select: { userId: true },
    });
    return !!match;
  }

  /**
   * Authorization for user-management actions.
   * - SYSADMIN may manage everyone (but not delete/demote themselves).
   * - ADMIN may only manage users of their own clubs and never a SYSADMIN.
   *   Other ADMINs can be edited (role/profile) but not deleted.
   */
  async assertCanManageUser(
    caller: Caller,
    targetId: string,
    action: UserManagementAction,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, lastLogin: true },
    });
    if (!target) throw new NotFoundException('User not found.');

    if (target.id === caller.id && (action === 'role' || action === 'delete')) {
      throw new ForbiddenException(
        'You cannot change your own role or delete your own account.',
      );
    }

    if (caller.role === 'SYSADMIN') return target;

    if (caller.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions.');
    }
    if (target.role === 'SYSADMIN') {
      throw new ForbiddenException('ADMINs cannot manage SYSADMIN accounts.');
    }
    if (action === 'delete' && target.role === 'ADMIN') {
      throw new ForbiddenException('ADMINs cannot delete other ADMINs.');
    }
    if (
      target.id !== caller.id &&
      !(await this.shareClub(caller.id, target.id))
    ) {
      throw new ForbiddenException('User is not a member of your club(s).');
    }
    return target;
  }

  /** Throws unless the caller is a member of the club (SYSADMIN bypasses). */
  async assertClubMember(caller: Caller, clubId: string) {
    if (caller.role === 'SYSADMIN') return;
    const membership = await this.prisma.userClub.findUnique({
      where: { userId_clubId: { userId: caller.id, clubId } },
      select: { userId: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this club.');
    }
  }

  /** Throws unless both users share a club (SYSADMIN bypasses). */
  async assertSharedClub(caller: Caller, otherUserId: string) {
    if (caller.role === 'SYSADMIN') return;
    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('User not found.');
    if (!(await this.shareClub(caller.id, otherUserId))) {
      throw new ForbiddenException('User is not a member of your club(s).');
    }
  }

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

  async updateRole(
    id: string,
    role: 'PLAYER' | 'COACH' | 'ADMIN' | 'SYSADMIN',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: this.userSelect,
    });
  }

  async updateProfile(
    id: string,
    dto: { firstName?: string | null; lastName?: string | null },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      },
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
    if (!this.resend) {
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
          <p>Hello${firstName ? ` ${escapeHtml(firstName)}` : ''},</p>
          <p>You have been invited to <strong>Golf Challenge Point</strong>.</p>
          <p>Use the temporary password below to log in for the first time:</p>
          <p><strong>${tempPassword}</strong></p>
          <p><a href="${loginUrl}">Log in here: ${loginUrl}</a></p>
          <p>Please change your password after your first login.</p>
        `,
      });
      this.logger.log(`Invite email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send invite email to ${to}: ${String(err)}`);
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
            playerCoachLinks: {
              select: {
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
            },
          },
        },
      },
    });
    const players = links
      .map((l) => {
        if (!l.player) return null;
        const { playerCoachLinks, ...playerData } = l.player;
        return {
          ...playerData,
          coaches: playerCoachLinks.map((pcl) => pcl.coach).filter(Boolean),
        };
      })
      .filter(
        (player): player is NonNullable<typeof player> => player !== null,
      );

    const playerIds = players.map((player) => player.id);
    const learningProgressByPlayerId = await loadPlayerLearningSummaries(
      this.prisma,
      playerIds,
    );

    return players.map((player) => ({
      ...player,
      pendingLessons:
        learningProgressByPlayerId[player.id]?.lessons.PENDING ?? 0,
      learningProgress: learningProgressByPlayerId[player.id] ?? {
        lessons: {
          PENDING: 0,
          ACCEPTED: 0,
          ACTIVE: 0,
          COMPLETED: 0,
        },
        journeys: {
          PENDING: 0,
          ACCEPTED: 0,
          ACTIVE: 0,
          COMPLETED: 0,
        },
        recentCompletions: {
          lessons: 0,
          journeys: 0,
        },
      },
    }));
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

  /** Unlink a player from the given coach. */
  async removePlayerFromCoach(coachId: string, playerId: string) {
    await this.prisma.coachPlayerLink.deleteMany({
      where: { coachId, playerId },
    });
    return this.getCoachPlayers(coachId);
  }

  async removePlayerCoach(playerId: string, coachId: string) {
    await this.prisma.coachPlayerLink.deleteMany({
      where: { coachId, playerId },
    });
    return this.getPlayerCoaches(playerId);
  }

  /** Resend the invitation email to a user who has not yet logged in. */
  async resendInvite(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.lastLogin) {
      // Prevents resetting the password of an active account via "invite".
      throw new BadRequestException(
        'User has already logged in. Use the password reset instead.',
      );
    }

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
