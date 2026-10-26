import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
} from '@nestjs/common';
import { GAME_HOOKS, type GameHooks } from '../game/game-hooks';
import { PrismaService } from '../prisma/prisma.service';
import { coachCanSeePlayer, coachTeamsWhere } from '../teams/team-access';
import {
  isTeamChatId,
  resolveRef,
  sendTeamMessage,
  teamChatRows,
  teamIdOf,
  teamThread,
  teamUnread,
} from './team-chat';

export const MAX_MESSAGE_LENGTH = 2000;
const PAGE_SIZE = 50;

const ROLE_LABEL: Record<string, string> = {
  HEAD_COACH: 'Head coach',
  ASSISTANT: 'Assistant coach',
  FITNESS: 'Fitness coach',
  MENTAL: 'Mental coach',
};

type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
};

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profileImage: true,
} as const;

export function personName(
  person: Pick<Person, 'firstName' | 'lastName' | 'email'>,
) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') ||
    person.email
  );
}

export function isCoachRole(role: string) {
  return role === 'COACH' || role === 'ADMIN';
}

/** Trims and checks a message text. */
export function cleanBody(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('The message must be text');
  }
  const body = value.replace(/\r\n/g, '\n').trim();
  if (!body) throw new BadRequestException('The message is empty');
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new BadRequestException(
      `A message can have at most ${MAX_MESSAGE_LENGTH} characters`,
    );
  }
  return body;
}

/**
 * The open question of a conversation: the coach's latest question without
 * a player message after it.
 */
export function openQuestionOf(
  lastQuestion: { id: string; body: string; createdAt: Date } | null,
  lastPlayerMessageAt: Date | null,
) {
  if (!lastQuestion) return null;
  if (lastPlayerMessageAt && lastPlayerMessageAt > lastQuestion.createdAt) {
    return null;
  }
  return lastQuestion;
}

/**
 * 1:1 messages between a coach and a player. A coach can write to linked
 * players and members of the coach's teams; a player to those coaches.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(GAME_HOOKS) private readonly game?: GameHooks,
  ) {}

  /** Coach and player of a pair, or 403. */
  private async pair(userId: string, role: string, otherId: string) {
    if (userId === otherId) {
      throw new BadRequestException('You cannot write to yourself');
    }
    const coachId = isCoachRole(role) ? userId : otherId;
    const playerId = isCoachRole(role) ? otherId : userId;
    if (!isCoachRole(role) && role !== 'PLAYER') {
      throw new ForbiddenException('Messages are for coaches and players');
    }
    const [coach, player] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: coachId },
        select: { ...PERSON_SELECT, role: true },
      }),
      this.prisma.user.findUnique({
        where: { id: playerId },
        select: { ...PERSON_SELECT, role: true },
      }),
    ]);
    if (
      !coach ||
      !player ||
      !isCoachRole(coach.role as string) ||
      player.role !== 'PLAYER'
    ) {
      throw new NotFoundException('Person not found');
    }
    if (!(await coachCanSeePlayer(this.prisma, coachId, playerId))) {
      throw new ForbiddenException('You do not work together');
    }
    return { coachId, playerId, coach, player };
  }

  /** People the user can write to, with a short role label. */
  private async contacts(userId: string, role: string) {
    if (isCoachRole(role)) {
      const [links, teams] = await Promise.all([
        this.prisma.coachPlayerLink.findMany({
          where: { coachId: userId },
          select: { player: { select: { ...PERSON_SELECT, role: true } } },
        }),
        this.prisma.team.findMany({
          where: coachTeamsWhere(userId),
          select: {
            shortName: true,
            members: {
              select: { user: { select: { ...PERSON_SELECT, role: true } } },
            },
          },
        }),
      ]);
      const map = new Map<string, { person: Person; labels: string[] }>();
      for (const link of links) {
        if (link.player.role !== 'PLAYER') continue;
        map.set(link.player.id, { person: link.player, labels: [] });
      }
      for (const team of teams) {
        for (const member of team.members) {
          if (member.user.role !== 'PLAYER') continue;
          const entry = map.get(member.user.id) ?? {
            person: member.user,
            labels: [],
          };
          entry.labels.push(team.shortName);
          map.set(member.user.id, entry);
        }
      }
      return [...map.values()].map(({ person, labels }) => ({
        person,
        label: labels.length ? labels.join(', ') : 'Player',
      }));
    }

    const [links, memberships] = await Promise.all([
      this.prisma.coachPlayerLink.findMany({
        where: { playerId: userId },
        select: { role: true, coach: { select: PERSON_SELECT } },
      }),
      this.prisma.teamMember.findMany({
        where: { userId },
        select: {
          team: {
            select: {
              shortName: true,
              coach: { select: PERSON_SELECT },
              staff: {
                select: { role: true, coach: { select: PERSON_SELECT } },
              },
            },
          },
        },
      }),
    ]);
    const map = new Map<string, { person: Person; labels: string[] }>();
    const add = (person: Person, label: string) => {
      const entry = map.get(person.id) ?? { person, labels: [] };
      if (!entry.labels.includes(label)) entry.labels.push(label);
      map.set(person.id, entry);
    };
    for (const link of links) {
      add(link.coach, ROLE_LABEL[link.role ?? ''] ?? 'Coach');
    }
    for (const { team } of memberships) {
      add(team.coach, `Head coach · ${team.shortName}`);
      for (const member of team.staff) {
        add(
          member.coach,
          `${ROLE_LABEL[member.role] ?? 'Coach'} · ${team.shortName}`,
        );
      }
    }
    return [...map.values()].map(({ person, labels }) => {
      // A plain "Coach" (link without a role) adds nothing next to a team role.
      const specific = labels.filter((label) => label !== 'Coach');
      return {
        person,
        label: (specific.length ? specific : labels).join(', '),
      };
    });
  }

  /** Conversations (newest first) and people without one yet. */
  async list(userId: string, role: string) {
    const coach = isCoachRole(role);
    const [contacts, conversations] = await Promise.all([
      this.contacts(userId, role),
      this.prisma.conversation.findMany({
        where: coach ? { coachId: userId } : { playerId: userId },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          coach: { select: PERSON_SELECT },
          player: { select: PERSON_SELECT },
        },
      }),
    ]);
    const contactById = new Map(contacts.map((c) => [c.person.id, c]));

    const rows = await Promise.all(
      conversations
        .filter((conversation) => conversation.lastMessageAt)
        .map(async (conversation) => {
          const other = coach ? conversation.player : conversation.coach;
          const readAt = coach
            ? conversation.coachReadAt
            : conversation.playerReadAt;
          const [last, unread, lastQuestion, lastPlayerMessage] =
            await Promise.all([
              this.prisma.message.findFirst({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: 'desc' },
                select: { body: true, senderId: true, createdAt: true },
              }),
              this.prisma.message.count({
                where: {
                  conversationId: conversation.id,
                  senderId: { not: userId },
                  ...(readAt ? { createdAt: { gt: readAt } } : {}),
                },
              }),
              this.prisma.message.findFirst({
                where: { conversationId: conversation.id, isQuestion: true },
                orderBy: { createdAt: 'desc' },
                select: { id: true, body: true, createdAt: true },
              }),
              this.prisma.message.findFirst({
                where: {
                  conversationId: conversation.id,
                  senderId: conversation.playerId,
                },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
              }),
            ]);
          const question = openQuestionOf(
            lastQuestion,
            lastPlayerMessage?.createdAt ?? null,
          );
          return {
            counterpart: {
              id: other.id,
              name: personName(other),
              profileImage: other.profileImage,
              label: contactById.get(other.id)?.label ?? null,
            },
            /** false when the two no longer work together (read only). */
            canWrite: contactById.has(other.id),
            lastMessage: last
              ? {
                  body: last.body,
                  mine: last.senderId === userId,
                  createdAt: last.createdAt,
                }
              : null,
            unread,
            openQuestion: question
              ? {
                  id: question.id,
                  body: question.body,
                  createdAt: question.createdAt,
                }
              : null,
          };
        }),
    );
    const withConversation = new Set(rows.map((row) => row.counterpart.id));
    const teamRows = await teamChatRows(this.prisma, userId, role);
    const time = (row: { lastMessage: { createdAt: Date } | null }) =>
      row.lastMessage ? new Date(row.lastMessage.createdAt).getTime() : 0;
    return {
      me: { id: userId, isCoach: coach },
      conversations: [...rows, ...teamRows].sort((a, b) => time(b) - time(a)),
      contacts: contacts
        .filter((contact) => !withConversation.has(contact.person.id))
        .map((contact) => ({
          id: contact.person.id,
          name: personName(contact.person),
          profileImage: contact.person.profileImage,
          label: contact.label,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** Unread messages in total and per person (for badges; cheap to poll). */
  async unread(userId: string, role: string) {
    const coach = isCoachRole(role);
    const conversations = await this.prisma.conversation.findMany({
      where: coach
        ? { coachId: userId, lastMessageAt: { not: null } }
        : { playerId: userId, lastMessageAt: { not: null } },
      select: {
        id: true,
        coachId: true,
        playerId: true,
        coachReadAt: true,
        playerReadAt: true,
        lastMessageAt: true,
      },
    });
    const byUser: Record<string, number> = {};
    let total = 0;
    await Promise.all(
      conversations.map(async (conversation) => {
        const readAt = coach
          ? conversation.coachReadAt
          : conversation.playerReadAt;
        if (
          readAt &&
          conversation.lastMessageAt &&
          readAt >= conversation.lastMessageAt
        ) {
          return;
        }
        const count = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            ...(readAt ? { createdAt: { gt: readAt } } : {}),
          },
        });
        if (count > 0) {
          byUser[coach ? conversation.playerId : conversation.coachId] = count;
          total += count;
        }
      }),
    );
    const team = await teamUnread(this.prisma, userId, role);
    return { total: total + team.total, byUser: { ...byUser, ...team.byUser } };
  }

  /** Messages with one person (newest page, or newer than `after`). */
  async thread(
    userId: string,
    role: string,
    otherId: string,
    query: { after?: string; before?: string },
  ) {
    if (isTeamChatId(otherId)) {
      return teamThread(this.prisma, userId, role, teamIdOf(otherId), query);
    }
    const { coachId, playerId, coach, player } = await this.pair(
      userId,
      role,
      otherId,
    ).catch(async (err: unknown) => {
      // Former partners may still read an existing conversation.
      const existing = await this.existingConversation(userId, role, otherId);
      if (!existing) throw err;
      return existing;
    });
    const isCoach = isCoachRole(role);
    const other = isCoach ? player : coach;
    const conversation = await this.prisma.conversation.findUnique({
      where: { coachId_playerId: { coachId, playerId } },
    });
    const base = {
      counterpart: {
        id: other.id,
        name: personName(other),
        profileImage: other.profileImage,
      },
    };
    if (!conversation) {
      return {
        ...base,
        conversationId: null,
        messages: [],
        otherReadAt: null,
        hasMore: false,
      };
    }
    const after = query.after ? new Date(query.after) : null;
    const before = query.before ? new Date(query.before) : null;
    if (
      (after && Number.isNaN(after.getTime())) ||
      (before && Number.isNaN(before.getTime()))
    ) {
      throw new BadRequestException('after/before must be ISO dates');
    }
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(after ? { createdAt: { gt: after } } : {}),
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: after ? 'asc' : 'desc' },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        senderId: true,
        body: true,
        isQuestion: true,
        refType: true,
        refId: true,
        refTitle: true,
        createdAt: true,
      },
    });
    const hasMore = !after && rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE);
    if (!after) page.reverse();

    // Reading the thread marks everything as read.
    const now = new Date();
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: isCoach ? { coachReadAt: now } : { playerReadAt: now },
      select: { coachReadAt: true, playerReadAt: true },
    });
    return {
      ...base,
      conversationId: conversation.id,
      messages: page.map((message) => ({
        ...message,
        mine: message.senderId === userId,
      })),
      otherReadAt: isCoach ? updated.playerReadAt : updated.coachReadAt,
      hasMore,
    };
  }

  private async existingConversation(
    userId: string,
    role: string,
    otherId: string,
  ) {
    const isCoach = isCoachRole(role);
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        coachId_playerId: isCoach
          ? { coachId: userId, playerId: otherId }
          : { coachId: otherId, playerId: userId },
      },
      include: {
        coach: { select: PERSON_SELECT },
        player: { select: PERSON_SELECT },
      },
    });
    if (!conversation) return null;
    return {
      coachId: conversation.coachId,
      playerId: conversation.playerId,
      coach: conversation.coach,
      player: conversation.player,
    };
  }

  async send(
    userId: string,
    role: string,
    otherId: string,
    input: { body?: unknown; isQuestion?: unknown; ref?: unknown },
  ) {
    const body = cleanBody(input.body);
    if (isTeamChatId(otherId)) {
      const teamId = teamIdOf(otherId);
      const ref = await resolveRef(this.prisma, input.ref, { teamId });
      const sent = await sendTeamMessage(
        this.prisma,
        userId,
        role,
        teamId,
        body,
        ref,
      );
      this.game?.notify(sent.recipients, 'messages', {
        title: `💬 ${sent.team.shortName}`,
        body: `${sent.senderFirstName ?? ''}: ${body}`.slice(0, 200),
        url: `/messages?with=${encodeURIComponent(otherId)}`,
        tag: `team-chat-${teamId}`,
      });
      return sent.message;
    }
    const { coachId, playerId } = await this.pair(userId, role, otherId);
    const ref = input.ref
      ? await resolveRef(this.prisma, input.ref, { playerId })
      : null;
    // Only coaches ask questions that wait for an answer.
    const isQuestion = isCoachRole(role) && input.isQuestion === true;
    const now = new Date();
    const conversation = await this.prisma.conversation.upsert({
      where: { coachId_playerId: { coachId, playerId } },
      create: {
        coachId,
        playerId,
        lastMessageAt: now,
        ...(isCoachRole(role) ? { coachReadAt: now } : { playerReadAt: now }),
      },
      update: {
        lastMessageAt: now,
        ...(isCoachRole(role) ? { coachReadAt: now } : { playerReadAt: now }),
      },
      select: { id: true },
    });
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        body,
        isQuestion,
        ...(ref ?? {}),
        createdAt: now,
      },
      select: {
        id: true,
        senderId: true,
        body: true,
        isQuestion: true,
        refType: true,
        refId: true,
        refTitle: true,
        createdAt: true,
      },
    });
    if (isCoachRole(role)) {
      void this.prisma.user
        .findUnique({ where: { id: userId }, select: { firstName: true } })
        .then((sender) =>
          this.game?.notify([playerId], 'messages', {
            title: isQuestion
              ? `❓ ${sender?.firstName ?? 'Your coach'} asked you something`
              : `💬 ${sender?.firstName ?? 'Your coach'}`,
            body: body.slice(0, 200),
            url: isQuestion ? '/dashboard' : `/messages?with=${userId}`,
            tag: `chat-${userId}`,
          }),
        )
        .catch(() => null);
    } else {
      // An answer to a coach question counts for the game.
      this.game?.syncQuietly(playerId);
      void this.prisma.user
        .findUnique({ where: { id: userId }, select: { firstName: true } })
        .then((sender) =>
          this.game?.notify([coachId], 'messages', {
            title: `💬 ${sender?.firstName ?? 'Your player'}`,
            body: body.slice(0, 200),
            url: `/messages?with=${userId}`,
            tag: `chat-${userId}`,
          }),
        )
        .catch(() => null);
    }
    return { ...message, mine: true, conversationId: conversation.id };
  }
}
