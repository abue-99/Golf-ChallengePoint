import { AssignmentStatus } from '@challengepoint/db';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const activeStatuses: AssignmentStatus[] = [
      AssignmentStatus.NEW,
      AssignmentStatus.OPEN,
      AssignmentStatus.IN_PROGRESS,
    ];

    const pendingCounts =
      memberIds.length === 0
        ? []
        : await this.prisma.lessonAssignment.groupBy({
            by: ['playerId'],
            where: {
              playerId: { in: memberIds },
              isInTrainingQueue: true,
              status: { in: activeStatuses },
            },
            _count: { _all: true },
          });

    const pendingByPlayerId = Object.fromEntries(
      pendingCounts
        .filter((row) => Boolean(row.playerId))
        .map((row) => [row.playerId as string, row._count._all]),
    );

    return teams.map((team) => ({
      ...team,
      pendingLessons: team.members.reduce(
        (sum, member) => sum + (pendingByPlayerId[member.userId] ?? 0),
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
    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: userSelect,
    });
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
