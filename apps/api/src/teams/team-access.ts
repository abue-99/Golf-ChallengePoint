import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export const COACH_ROLES = [
  'HEAD_COACH',
  'ASSISTANT',
  'FITNESS',
  'MENTAL',
] as const;
export type CoachRoleValue = (typeof COACH_ROLES)[number];

/** Roles a further coach of a team can have (the head coach is teams.coachId). */
export const STAFF_ROLES: CoachRoleValue[] = ['ASSISTANT', 'FITNESS', 'MENTAL'];

export function isCoachRole(value: unknown): value is CoachRoleValue {
  return (
    typeof value === 'string' && COACH_ROLES.includes(value as CoachRoleValue)
  );
}

/**
 * Prisma filter: teams the coach works with – as head coach or as part of
 * the coaching staff.
 */
export function coachTeamsWhere(coachId: string) {
  return {
    OR: [{ coachId }, { staff: { some: { coachId } } }],
  };
}

export type TeamAccess = {
  id: string;
  coachId: string;
  shortName: string;
  clubId: string | null;
  isHead: boolean;
  /** HEAD_COACH for the head coach, the staff role otherwise (null for admins). */
  role: CoachRoleValue | null;
};

/**
 * The team, if the coach works with it (head coach or staff); throws
 * otherwise. Admins may act on every team.
 */
export async function assertTeamAccess(
  prisma: PrismaService,
  coachId: string,
  role: string,
  teamId: string,
): Promise<TeamAccess> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      coachId: true,
      shortName: true,
      clubId: true,
      staff: { where: { coachId }, select: { role: true } },
    },
  });
  if (!team) throw new NotFoundException('Team not found');
  const base = {
    id: team.id,
    coachId: team.coachId,
    shortName: team.shortName,
    clubId: team.clubId,
  };
  if (team.coachId === coachId) {
    return { ...base, isHead: true, role: 'HEAD_COACH' };
  }
  const staff = team.staff[0];
  if (staff) {
    return { ...base, isHead: false, role: staff.role as CoachRoleValue };
  }
  if (role === 'ADMIN') return { ...base, isHead: true, role: null };
  throw new ForbiddenException('Not your team');
}

/** Only the head coach (or an admin) may change team settings and staff. */
export async function assertHeadCoach(
  prisma: PrismaService,
  coachId: string,
  role: string,
  teamId: string,
) {
  const access = await assertTeamAccess(prisma, coachId, role, teamId);
  if (!access.isHead) {
    throw new ForbiddenException('Only the head coach can do this');
  }
  return access;
}

/**
 * Coaches work with their linked players and with the members of every team
 * they coach (head coach or staff).
 */
export async function coachCanSeePlayer(
  prisma: PrismaService,
  coachId: string,
  playerId: string,
) {
  const [link, membership] = await Promise.all([
    prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
      select: { id: true },
    }),
    prisma.teamMember.findFirst({
      where: { userId: playerId, team: coachTeamsWhere(coachId) },
      select: { id: true },
    }),
  ]);
  return Boolean(link || membership);
}

export async function assertCoachCanSeePlayer(
  prisma: PrismaService,
  coachId: string,
  playerId: string,
  message = 'Not linked to this player',
) {
  if (!(await coachCanSeePlayer(prisma, coachId, playerId))) {
    throw new ForbiddenException(message);
  }
}

/** Writes on a player's own data (blocks, plans …) need a real link. */
export async function assertCoachLinkedToPlayer(
  prisma: PrismaService,
  coachId: string,
  playerId: string,
) {
  const link = await prisma.coachPlayerLink.findFirst({
    where: { coachId, playerId },
    select: { id: true },
  });
  if (!link) throw new ForbiddenException('Not linked to this player');
}
