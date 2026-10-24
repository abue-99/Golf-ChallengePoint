import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CoachRole } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCoachCanSeePlayer,
  assertHeadCoach,
  assertTeamAccess,
  isCoachRole,
  STAFF_ROLES,
  type CoachRoleValue,
} from './team-access';

const COACH_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profileImage: true,
} as const;

function parseStaffRole(value: unknown): CoachRoleValue {
  if (value === undefined || value === null || value === '') return 'ASSISTANT';
  if (!isCoachRole(value) || !STAFF_ROLES.includes(value)) {
    throw new BadRequestException(
      'role must be ASSISTANT, FITNESS or MENTAL (use the head-coach transfer for HEAD_COACH)',
    );
  }
  return value;
}

/**
 * Coaching staff of a team. The head coach is `teams.coachId` and manages
 * the staff; further coaches (assistant, fitness, mental) plan with the team.
 */
@Injectable()
export class TeamStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, role: string, teamId: string) {
    const access = await assertTeamAccess(this.prisma, userId, role, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        coach: { select: COACH_SELECT },
        staff: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            createdAt: true,
            coach: { select: COACH_SELECT },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return {
      teamId,
      isHeadCoach: access.isHead,
      myRole: access.role,
      staff: [
        { role: 'HEAD_COACH' as const, coach: team.coach, createdAt: null },
        ...team.staff,
      ].map((member) => ({
        coachId: member.coach.id,
        firstName: member.coach.firstName,
        lastName: member.coach.lastName,
        email: member.coach.email,
        profileImage: member.coach.profileImage,
        role: member.role,
        isHead: member.role === 'HEAD_COACH',
        isMe: member.coach.id === userId,
      })),
    };
  }

  /** Coaches of the team's club (or the head coach's clubs) not yet on staff. */
  async candidates(userId: string, role: string, teamId: string) {
    const access = await assertHeadCoach(this.prisma, userId, role, teamId);
    const clubIds = access.clubId
      ? [access.clubId]
      : (
          await this.prisma.userClub.findMany({
            where: { userId: access.coachId },
            select: { clubId: true },
          })
        ).map((club) => club.clubId);
    if (clubIds.length === 0) return [];
    const existing = await this.prisma.teamCoach.findMany({
      where: { teamId },
      select: { coachId: true },
    });
    const exclude = [access.coachId, ...existing.map((row) => row.coachId)];
    return this.prisma.user.findMany({
      where: {
        role: { in: ['COACH', 'ADMIN'] },
        id: { notIn: exclude },
        userClubs: { some: { clubId: { in: clubIds } } },
      },
      select: COACH_SELECT,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async add(
    userId: string,
    role: string,
    teamId: string,
    body: { coachId?: unknown; role?: unknown },
  ) {
    await assertHeadCoach(this.prisma, userId, role, teamId);
    if (typeof body.coachId !== 'string' || !body.coachId) {
      throw new BadRequestException('coachId is required');
    }
    const staffRole = parseStaffRole(body.role);
    const candidates = await this.candidates(userId, role, teamId);
    if (!candidates.some((candidate) => candidate.id === body.coachId)) {
      throw new ForbiddenException(
        'Only coaches of the same club can join the coaching staff',
      );
    }
    await this.prisma.teamCoach.create({
      data: { teamId, coachId: body.coachId, role: staffRole as CoachRole },
    });
    return this.list(userId, role, teamId);
  }

  async changeRole(
    userId: string,
    role: string,
    teamId: string,
    coachId: string,
    newRole: unknown,
  ) {
    await assertHeadCoach(this.prisma, userId, role, teamId);
    const staffRole = parseStaffRole(newRole);
    const result = await this.prisma.teamCoach.updateMany({
      where: { teamId, coachId },
      data: { role: staffRole as CoachRole },
    });
    if (result.count === 0) {
      throw new NotFoundException('This coach is not on the coaching staff');
    }
    return this.list(userId, role, teamId);
  }

  /** The head coach removes someone, or a staff member leaves the team. */
  async remove(userId: string, role: string, teamId: string, coachId: string) {
    const access = await assertTeamAccess(this.prisma, userId, role, teamId);
    if (!access.isHead && coachId !== userId) {
      throw new ForbiddenException('Only the head coach can do this');
    }
    if (coachId === access.coachId) {
      throw new BadRequestException(
        'The head coach cannot leave – hand the team over first',
      );
    }
    const result = await this.prisma.teamCoach.deleteMany({
      where: { teamId, coachId },
    });
    if (result.count === 0) {
      throw new NotFoundException('This coach is not on the coaching staff');
    }
    return { ok: true, left: coachId === userId };
  }

  /** Hand the team over: the staff member becomes head coach, the old head an assistant. */
  async transferHead(
    userId: string,
    role: string,
    teamId: string,
    coachId: unknown,
  ) {
    const access = await assertHeadCoach(this.prisma, userId, role, teamId);
    if (typeof coachId !== 'string' || !coachId) {
      throw new BadRequestException('coachId is required');
    }
    const member = await this.prisma.teamCoach.findUnique({
      where: { teamId_coachId: { teamId, coachId } },
    });
    if (!member) {
      throw new BadRequestException(
        'Add the coach to the coaching staff first',
      );
    }
    const previousHead = access.coachId;
    await this.prisma.$transaction(async (tx) => {
      await tx.teamCoach.delete({ where: { id: member.id } });
      await tx.team.update({ where: { id: teamId }, data: { coachId } });
      await tx.teamCoach.upsert({
        where: { teamId_coachId: { teamId, coachId: previousHead } },
        create: { teamId, coachId: previousHead, role: 'ASSISTANT' },
        update: { role: 'ASSISTANT' },
      });
    });
    return this.list(userId, role, teamId);
  }

  /** A coach sets their own role for a linked player. */
  async setPlayerRole(
    coachId: string,
    role: string,
    playerId: string,
    newRole: unknown,
  ) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches have a role for players');
    }
    await assertCoachCanSeePlayer(this.prisma, coachId, playerId);
    if (newRole !== null && !isCoachRole(newRole)) {
      throw new BadRequestException(
        'role must be HEAD_COACH, ASSISTANT, FITNESS, MENTAL or null',
      );
    }
    const result = await this.prisma.coachPlayerLink.updateMany({
      where: { coachId, playerId },
      data: { role: newRole as CoachRole | null },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        'Add the player to "My players" first to set your role',
      );
    }
    return { playerId, role: newRole };
  }
}
