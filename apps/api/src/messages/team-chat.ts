import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';

/** Team chats appear in the message list with the id "team:<teamId>". */
export const TEAM_PREFIX = 'team:';
const PAGE_SIZE = 50;

export function isTeamChatId(id: string) {
  return id.startsWith(TEAM_PREFIX);
}

export function teamIdOf(id: string) {
  return id.slice(TEAM_PREFIX.length);
}

function coachRole(role: string) {
  return role === 'COACH' || role === 'ADMIN';
}

function nameOf(person: {
  firstName: string | null;
  lastName: string | null;
  email?: string;
}) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') ||
    person.email ||
    ''
  );
}

/** Teams whose chat the user may read and write. */
export async function chatTeams(
  prisma: PrismaService,
  userId: string,
  role: string,
) {
  const teams = await prisma.team.findMany({
    where: coachRole(role)
      ? coachTeamsWhere(userId)
      : { members: { some: { userId } } },
    select: {
      id: true,
      shortName: true,
      icon: true,
      _count: { select: { members: true } },
    },
    orderBy: { shortName: 'asc' },
  });
  return teams;
}

export async function assertTeamChat(
  prisma: PrismaService,
  userId: string,
  role: string,
  teamId: string,
) {
  const teams = await chatTeams(prisma, userId, role);
  const team = teams.find((item) => item.id === teamId);
  if (!team) throw new ForbiddenException('Not your team');
  return team;
}

/** Rows for the conversation list (only teams with messages or all teams). */
export async function teamChatRows(
  prisma: PrismaService,
  userId: string,
  role: string,
) {
  const teams = await chatTeams(prisma, userId, role);
  return Promise.all(
    teams.map(async (team) => {
      const [last, read] = await Promise.all([
        prisma.teamMessage.findFirst({
          where: { teamId: team.id },
          orderBy: { createdAt: 'desc' },
          select: {
            body: true,
            senderId: true,
            createdAt: true,
            sender: { select: { firstName: true } },
          },
        }),
        prisma.teamChatRead.findUnique({
          where: { teamId_userId: { teamId: team.id, userId } },
          select: { readAt: true },
        }),
      ]);
      const unread = last
        ? await prisma.teamMessage.count({
            where: {
              teamId: team.id,
              senderId: { not: userId },
              ...(read ? { createdAt: { gt: read.readAt } } : {}),
            },
          })
        : 0;
      return {
        counterpart: {
          id: `${TEAM_PREFIX}${team.id}`,
          name: `${team.shortName}`,
          profileImage: null,
          label: `Team chat · ${team._count.members} members`,
          isTeam: true,
          icon: team.icon,
        },
        canWrite: true,
        lastMessage: last
          ? {
              body:
                last.senderId === userId
                  ? last.body
                  : `${last.sender.firstName ?? ''}: ${last.body}`,
              mine: last.senderId === userId,
              createdAt: last.createdAt,
            }
          : null,
        unread,
        openQuestion: null,
      };
    }),
  );
}

export async function teamUnread(
  prisma: PrismaService,
  userId: string,
  role: string,
) {
  const teams = await chatTeams(prisma, userId, role);
  const byUser: Record<string, number> = {};
  let total = 0;
  await Promise.all(
    teams.map(async (team) => {
      const read = await prisma.teamChatRead.findUnique({
        where: { teamId_userId: { teamId: team.id, userId } },
        select: { readAt: true },
      });
      const count = await prisma.teamMessage.count({
        where: {
          teamId: team.id,
          senderId: { not: userId },
          ...(read ? { createdAt: { gt: read.readAt } } : {}),
        },
      });
      if (count > 0) {
        byUser[`${TEAM_PREFIX}${team.id}`] = count;
        total += count;
      }
    }),
  );
  return { total, byUser };
}

export async function teamThread(
  prisma: PrismaService,
  userId: string,
  role: string,
  teamId: string,
  query: { after?: string; before?: string },
) {
  const team = await assertTeamChat(prisma, userId, role, teamId);
  const after = query.after ? new Date(query.after) : null;
  const before = query.before ? new Date(query.before) : null;
  if (
    (after && Number.isNaN(after.getTime())) ||
    (before && Number.isNaN(before.getTime()))
  ) {
    throw new BadRequestException('after/before must be ISO dates');
  }
  const rows = await prisma.teamMessage.findMany({
    where: {
      teamId,
      ...(after ? { createdAt: { gt: after } } : {}),
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      senderId: true,
      body: true,
      refType: true,
      refId: true,
      refTitle: true,
      createdAt: true,
      sender: { select: { firstName: true, lastName: true, role: true } },
    },
  });
  const hasMore = !after && rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  if (!after) page.reverse();
  await prisma.teamChatRead.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId, readAt: new Date() },
    update: { readAt: new Date() },
  });
  return {
    counterpart: {
      id: `${TEAM_PREFIX}${team.id}`,
      name: team.shortName,
      profileImage: null,
      isTeam: true,
      icon: team.icon,
    },
    conversationId: `${TEAM_PREFIX}${team.id}`,
    messages: page.map(({ sender, ...message }) => ({
      ...message,
      isQuestion: false,
      mine: message.senderId === userId,
      senderName: nameOf(sender),
      senderIsCoach: coachRole(sender.role as string),
    })),
    otherReadAt: null,
    hasMore,
  };
}

export async function sendTeamMessage(
  prisma: PrismaService,
  userId: string,
  role: string,
  teamId: string,
  body: string,
  ref: { refType: string; refId: string; refTitle: string } | null,
) {
  const team = await assertTeamChat(prisma, userId, role, teamId);
  const message = await prisma.teamMessage.create({
    data: { teamId, senderId: userId, body, ...(ref ?? {}) },
    select: {
      id: true,
      senderId: true,
      body: true,
      refType: true,
      refId: true,
      refTitle: true,
      createdAt: true,
      sender: { select: { firstName: true, lastName: true, role: true } },
    },
  });
  await prisma.teamChatRead.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId, readAt: message.createdAt },
    update: { readAt: message.createdAt },
  });
  const [members, staff, full] = await Promise.all([
    prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
    prisma.teamCoach.findMany({ where: { teamId }, select: { coachId: true } }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { coachId: true },
    }),
  ]);
  const recipients = [
    ...members.map((m) => m.userId),
    ...staff.map((s) => s.coachId),
    ...(full ? [full.coachId] : []),
  ].filter((id) => id !== userId);
  const { sender, ...rest } = message;
  return {
    message: {
      ...rest,
      isQuestion: false,
      mine: true,
      senderName: nameOf(sender),
      senderIsCoach: coachRole(sender.role as string),
      conversationId: `${TEAM_PREFIX}${team.id}`,
    },
    team,
    recipients: [...new Set(recipients)],
    senderFirstName: sender.firstName,
  };
}

/** Resolves a link in a message to a title the sender may see. */
export async function resolveRef(
  prisma: PrismaService,
  input: unknown,
  scope: { playerId?: string; teamId?: string },
) {
  if (!input || typeof input !== 'object') return null;
  const { type, id } = input as { type?: unknown; id?: unknown };
  if (typeof type !== 'string' || typeof id !== 'string') return null;
  if (type === 'assignment') {
    const assignment = await prisma.lessonAssignment.findUnique({
      where: { id },
      select: {
        playerId: true,
        teamId: true,
        lesson: { select: { name: true } },
      },
    });
    const allowed =
      assignment &&
      ((scope.playerId && assignment.playerId === scope.playerId) ||
        (scope.teamId && assignment.teamId === scope.teamId));
    if (!assignment || !allowed)
      throw new NotFoundException('Mission not found');
    return {
      refType: 'assignment',
      refId: id,
      refTitle: assignment.lesson.name,
    };
  }
  if (type === 'challenge') {
    const challenge = await prisma.teamChallenge.findUnique({
      where: { id },
      select: { teamId: true, title: true },
    });
    if (!challenge || !scope.teamId || challenge.teamId !== scope.teamId) {
      throw new NotFoundException('Challenge not found');
    }
    return { refType: 'challenge', refId: id, refTitle: challenge.title };
  }
  throw new BadRequestException('Unknown link type');
}
