import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadPlayerLearningSummaries } from '../assignments/assignment-lifecycle';

type TeamInput = {
  icon?: string | null;
  shortName?: string;
  description?: string | null;
  category?: string;
  clubId?: string | null;
};

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the user is a member of the given club. */
  private async assertClubMember(userId: string, clubId: string) {
    const membership = await this.prisma.userClub.findUnique({
      where: { userId_clubId: { userId, clubId } },
      select: { userId: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this club.');
    }
  }

  /**
   * Copies only the fields a coach may change. Prevents mass assignment of
   * e.g. coachId or id via the request body.
   */
  private pickTeamFields(data: TeamInput) {
    const result: TeamInput = {};
    if (data.icon !== undefined) result.icon = data.icon;
    if (data.shortName !== undefined) {
      if (typeof data.shortName !== 'string' || !data.shortName.trim()) {
        throw new BadRequestException('shortName must not be empty.');
      }
      result.shortName = data.shortName.trim();
    }
    if (data.description !== undefined) result.description = data.description;
    if (data.category !== undefined) result.category = data.category ?? '';
    if (data.clubId !== undefined) result.clubId = data.clubId || null;
    return result;
  }

  async getCoachTeams(coachId: string) {
    const teams = await this.prisma.team.findMany({
      where: { coachId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const memberIds = [
      ...new Set(
        teams.flatMap((team) => team.members.map((member) => member.userId)),
      ),
    ];
    const learningProgressByPlayerId = await loadPlayerLearningSummaries(
      this.prisma,
      memberIds,
    );

    return teams.map((team) => ({
      ...team,
      pendingLessons: team.members.reduce(
        (sum, member) =>
          sum +
          (learningProgressByPlayerId[member.userId]?.lessons.PENDING ?? 0),
        0,
      ),
    }));
  }

  async getCoachCategories(coachId: string) {
    const teams = await this.prisma.team.findMany({
      where: { coachId },
      select: { category: true },
      distinct: ['category'],
    });
    return teams.map((t) => t.category).filter(Boolean);
  }

  async getClubUsers(coachId: string, clubId?: string) {
    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImage: true,
      role: true,
      phoneNumber: true,
      timezone: true,
      lastLogin: true,
      userClubs: {
        select: {
          clubId: true,
          club: { select: { id: true, name: true } },
        },
      },
    } as const;

    // Determine which clubs to search
    let targetClubIds: string[];
    if (clubId) {
      // Only clubs the coach belongs to may be browsed.
      await this.assertClubMember(coachId, clubId);
      targetClubIds = [clubId];
    } else {
      // No club specified: use all clubs the coach belongs to
      const coachClubs = await this.prisma.userClub.findMany({
        where: { userId: coachId },
        select: { clubId: true },
      });
      targetClubIds = coachClubs.map((c) => c.clubId);
    }

    if (targetClubIds.length === 0) return [];

    // Step 1: get distinct userIds from the target clubs.
    // This is kept as a separate query (select-only, no include) to avoid a
    // Prisma limitation where using distinct + include on UserClub while the
    // nested userClubs select also references the same table causes players
    // with multiple club memberships to be silently dropped from results.
    const userClubRecords = await this.prisma.userClub.findMany({
      where: { clubId: { in: targetClubIds } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = userClubRecords.map((r) => r.userId);
    if (userIds.length === 0) return [];

    // Step 2: fetch the full user records by ID.
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: userSelect,
    });

    const playerIds = users
      .filter((user) => user.role === 'PLAYER')
      .map((user) => user.id);
    const learningProgressByPlayerId = await loadPlayerLearningSummaries(
      this.prisma,
      playerIds,
    );

    return users.map((user) => ({
      ...user,
      pendingLessons: learningProgressByPlayerId[user.id]?.lessons.PENDING ?? 0,
      learningProgress: learningProgressByPlayerId[user.id] ?? {
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

  // Keep backward-compat alias
  getClubPlayers(coachId: string) {
    return this.getClubUsers(coachId);
  }

  async createTeam(
    coachId: string,
    data: {
      icon?: string;
      shortName: string;
      description?: string;
      category?: string;
      clubId?: string;
    },
  ) {
    const fields = this.pickTeamFields(data);
    if (!fields.shortName) {
      throw new BadRequestException('shortName is required.');
    }
    if (fields.clubId) await this.assertClubMember(coachId, fields.clubId);
    return this.prisma.team.create({
      data: {
        ...fields,
        shortName: fields.shortName,
        category: fields.category ?? '',
        coachId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async updateTeam(
    coachId: string,
    teamId: string,
    data: {
      icon?: string;
      shortName?: string;
      description?: string;
      category?: string;
      clubId?: string | null;
    },
  ) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException();
    const fields = this.pickTeamFields(data);
    if (fields.clubId) await this.assertClubMember(coachId, fields.clubId);
    return this.prisma.team.update({
      where: { id: teamId },
      data: fields,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async deleteTeam(coachId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException();
    await this.prisma.team.delete({ where: { id: teamId } });
    return { ok: true };
  }

  async addMember(coachId: string, teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException();
    await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: {},
      create: { teamId, userId },
    });
    return this.getTeamWithMembers(teamId);
  }

  async removeMember(coachId: string, teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException();
    await this.prisma.teamMember.deleteMany({ where: { teamId, userId } });
    return this.getTeamWithMembers(teamId);
  }

  async getTeamById(coachId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException();
    return team;
  }

  private getTeamWithMembers(teamId: string) {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }
}
