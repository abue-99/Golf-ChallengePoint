import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadPlayerLearningSummaries } from '../assignments/assignment-lifecycle';
import { coachTeamsWhere } from './team-access';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoachTeams(coachId: string) {
    const teams = await this.prisma.team.findMany({
      where: coachTeamsWhere(coachId),
      include: {
        coach: { select: { id: true, firstName: true, lastName: true } },
        staff: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            coach: { select: { id: true, firstName: true, lastName: true } },
          },
        },
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

    return teams.map(({ coach, staff, ...team }) => ({
      ...team,
      isHeadCoach: team.coachId === coachId,
      myRole:
        team.coachId === coachId
          ? 'HEAD_COACH'
          : (staff.find((member) => member.coach.id === coachId)?.role ?? null),
      staff: [{ role: 'HEAD_COACH', coach }, ...staff].map((member) => ({
        coachId: member.coach.id,
        firstName: member.coach.firstName,
        lastName: member.coach.lastName,
        role: member.role,
      })),
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
      where: coachTeamsWhere(coachId),
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
    return this.prisma.team.create({
      data: { ...data, category: data.category ?? '', coachId },
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
    return this.prisma.team.update({
      where: { id: teamId },
      data,
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
    if (
      team.coachId !== coachId &&
      !(await this.prisma.teamCoach.findUnique({
        where: { teamId_coachId: { teamId, coachId } },
        select: { id: true },
      }))
    ) {
      throw new ForbiddenException();
    }
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
