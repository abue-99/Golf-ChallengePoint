import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async getClubPlayers(coachId: string) {
    const coachClubs = await this.prisma.userClub.findMany({
      where: { userId: coachId },
      select: { clubId: true },
    });
    const clubIds = coachClubs.map((c) => c.clubId);

    const members = await this.prisma.userClub.findMany({
      where: { clubId: { in: clubIds }, user: { role: 'PLAYER' } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      distinct: ['userId'],
    });

    return members.map((m) => m.user);
  }

  async createTeam(
    coachId: string,
    data: { shortName: string; description: string; category: string },
  ) {
    return this.prisma.team.create({
      data: { ...data, coachId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
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
    data: { shortName?: string; description?: string; category?: string },
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
              },
            },
          },
        },
      },
    });
  }
}
