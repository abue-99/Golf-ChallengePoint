import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Prisma filter: teams the coach works with. */
export function coachTeamsWhere(coachId: string) {
  return { coachId };
}

/**
 * The team, if the coach works with it; throws otherwise.
 * Admins may act on every team.
 */
export async function assertTeamAccess(
  prisma: PrismaService,
  coachId: string,
  role: string,
  teamId: string,
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, coachId: true, shortName: true },
  });
  if (!team) throw new NotFoundException('Team not found');
  if (role === 'ADMIN' || team.coachId === coachId) return team;
  throw new ForbiddenException('Not your team');
}
