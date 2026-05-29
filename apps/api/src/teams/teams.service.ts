import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  getCoachTeams(coachId: string) {
    return this.prisma.team.findMany({
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

    if (clubId) {
      // Return all users (any role) from the specified club
      const members = await this.prisma.userClub.findMany({
        where: { clubId },
        include: {
          user: { select: userSelect },
        },
        distinct: ['userId'],
      });
      return members.map((m) => m.user).filter(Boolean);
    }

    // No club specified: return all users from all clubs the coach belongs to
    const coachClubs = await this.prisma.userClub.findMany({
      where: { userId: coachId },
      select: { clubId: true },
    });
    const clubIds = coachClubs.map((c) => c.clubId);

    const members = await this.prisma.userClub.findMany({
      where: { clubId: { in: clubIds } },
      include: {
        user: { select: userSelect },
      },
      distinct: ['userId'],
    });

    return members.map((m) => m.user).filter(Boolean);
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
