import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AssignmentStatus, OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachCanSeePlayer, coachTeamsWhere } from '../teams/team-access';
import { slotOccurrenceKey } from '../calendar/attendance.service';
import { expandEffective, loadSlotExceptions } from '../calendar/occurrences';
import { resolveTimeZone } from './roster.helpers';
import {
  DEFAULT_WEEKLY_LIMIT,
  EVENT_CAP_MINUTES,
  findDuplicates,
  summarizeWeeks,
  weekStarts,
  type LoadItem,
} from './player-load';

const OPEN_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.NEW,
  AssignmentStatus.OPEN,
  AssignmentStatus.IN_PROGRESS,
];
const MIN_LIMIT = 60;
const MAX_LIMIT = 40 * 60;

function fullName(user: {
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email ||
    'Coach'
  );
}

/**
 * Training load of the coach's players across all their coaches: team
 * trainings and events of all their teams, individual sessions and lessons
 * with a due date, per week and per coach – plus lessons two coaches gave
 * the same player.
 */
@Injectable()
export class PlayerLoadService {
  constructor(private readonly prisma: PrismaService) {}

  async getLoad(coachId: string, requestedTimeZone?: string) {
    const timeZone = resolveTimeZone(
      requestedTimeZone,
      process.env.TZ || 'Europe/Berlin',
    );
    const now = new Date();
    const starts = weekStarts(now, timeZone, 2);
    const from = starts[0];
    const to = starts[starts.length - 1];

    // The coach's players: linked ones and members of the coach's teams.
    const [links, teams] = await Promise.all([
      this.prisma.coachPlayerLink.findMany({
        where: { coachId },
        select: { playerId: true },
      }),
      this.prisma.team.findMany({
        where: coachTeamsWhere(coachId),
        select: {
          members: {
            select: { userId: true, user: { select: { role: true } } },
          },
        },
      }),
    ]);
    const playerIds = [
      ...new Set([
        ...links.map((link) => link.playerId),
        ...teams.flatMap((team) =>
          team.members
            .filter((member) => member.user.role === 'PLAYER')
            .map((member) => member.userId),
        ),
      ]),
    ];
    if (playerIds.length === 0) {
      return { timeZone, defaultLimit: DEFAULT_WEEKLY_LIMIT, players: [] };
    }

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: { in: playerIds } },
      select: { userId: true, teamId: true },
    });
    const teamIds = [...new Set(memberships.map((m) => m.teamId))];

    const [
      players,
      slots,
      events,
      sessions,
      lessons,
      openAssignments,
      tournaments,
      declined,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, weeklyLoadLimit: true },
      }),
      teamIds.length
        ? this.prisma.practiceSlot.findMany({
            where: {
              ownerType: OwnerType.TEAM,
              teamId: { in: teamIds },
              startTime: { lte: to },
            },
            select: {
              id: true,
              teamId: true,
              createdById: true,
              startTime: true,
              endTime: true,
              recurrence: true,
              recurrenceEndDate: true,
            },
          })
        : Promise.resolve([]),
      teamIds.length
        ? this.prisma.teamEvent.findMany({
            where: {
              teamId: { in: teamIds },
              startTime: { gte: from, lt: to },
            },
            select: {
              id: true,
              teamId: true,
              coachId: true,
              startTime: true,
              endTime: true,
            },
          })
        : Promise.resolve([]),
      // Individual sessions: lessons planned in a player's own windows.
      this.prisma.calendarTask.findMany({
        where: {
          scheduledDate: { gte: from, lt: to },
          practiceSlot: { playerId: { in: playerIds } },
        },
        select: {
          scheduledDate: true,
          durationMinutes: true,
          coachId: true,
          practiceSlot: { select: { playerId: true } },
        },
      }),
      // Lessons to practise with a due date (not already a calendar session).
      this.prisma.lessonAssignment.findMany({
        where: {
          playerId: { in: playerIds },
          dueDate: { gte: from, lt: to },
          status: { not: AssignmentStatus.ARCHIVED },
          calendarTask: { is: null },
        },
        select: {
          playerId: true,
          coachId: true,
          dueDate: true,
          lesson: { select: { durationMinutes: true } },
        },
      }),
      this.prisma.lessonAssignment.findMany({
        where: { playerId: { in: playerIds }, status: { in: OPEN_STATUSES } },
        select: {
          playerId: true,
          coachId: true,
          lessonId: true,
          lesson: { select: { name: true } },
        },
      }),
      this.prisma.tournament.findMany({
        where: {
          playerId: { in: playerIds },
          endTime: { gte: from },
          startTime: { lt: to },
        },
        select: { playerId: true, startTime: true, endTime: true },
      }),
      this.prisma.attendance.findMany({
        where: {
          playerId: { in: playerIds },
          status: 'NOT_GOING',
          occurrenceStart: { gte: from, lt: to },
        },
        select: { playerId: true, occurrenceKey: true },
      }),
    ]);

    const exceptions = await loadSlotExceptions(
      this.prisma,
      slots.map((slot) => slot.id),
    );
    const declinedKeys = new Set(
      declined.map((entry) => `${entry.playerId}|${entry.occurrenceKey}`),
    );
    const items = new Map<string, LoadItem[]>(playerIds.map((id) => [id, []]));
    const add = (playerId: string | null, item: LoadItem) => {
      if (playerId) items.get(playerId)?.push(item);
    };
    const membersOf = (teamId: string) =>
      memberships.filter((m) => m.teamId === teamId).map((m) => m.userId);
    const minutesOf = (start: Date, end: Date) =>
      Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

    for (const slot of slots) {
      const occurrences = expandEffective(
        slot,
        exceptions.get(slot.id),
        from,
        to,
      ).filter(
        (occurrence) =>
          occurrence.status !== 'cancelled' &&
          occurrence.start >= from &&
          occurrence.start < to,
      );
      for (const playerId of membersOf(slot.teamId as string)) {
        for (const occurrence of occurrences) {
          const key = slotOccurrenceKey(slot.id, occurrence.start);
          if (declinedKeys.has(`${playerId}|${key}`)) continue;
          add(playerId, {
            start: occurrence.start,
            minutes: minutesOf(occurrence.start, occurrence.end),
            kind: 'training',
            coachId: slot.createdById,
          });
        }
      }
    }
    for (const event of events) {
      for (const playerId of membersOf(event.teamId)) {
        if (declinedKeys.has(`${playerId}|event:${event.id}`)) continue;
        add(playerId, {
          start: event.startTime,
          minutes: Math.min(
            EVENT_CAP_MINUTES,
            minutesOf(event.startTime, event.endTime),
          ),
          kind: 'event',
          coachId: event.coachId,
        });
      }
    }
    for (const session of sessions) {
      add(session.practiceSlot.playerId, {
        start: session.scheduledDate,
        minutes: session.durationMinutes,
        kind: 'session',
        coachId: session.coachId,
      });
    }
    for (const lesson of lessons) {
      add(lesson.playerId, {
        start: lesson.dueDate as Date,
        minutes: lesson.lesson.durationMinutes ?? 0,
        kind: 'lesson',
        coachId: lesson.coachId,
      });
    }

    const coachIds = new Set<string>();
    for (const list of items.values()) {
      for (const item of list) if (item.coachId) coachIds.add(item.coachId);
    }
    for (const assignment of openAssignments) coachIds.add(assignment.coachId);
    const coaches = await this.prisma.user.findMany({
      where: { id: { in: [...coachIds] } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const nameById = new Map(coaches.map((c) => [c.id, fullName(c)]));
    const coachName = (id: string | null) =>
      id === coachId ? 'You' : ((id && nameById.get(id)) ?? 'Other');

    const limitById = new Map(players.map((p) => [p.id, p.weeklyLoadLimit]));
    return {
      timeZone,
      defaultLimit: DEFAULT_WEEKLY_LIMIT,
      players: playerIds.map((playerId) => {
        const limit = limitById.get(playerId) ?? DEFAULT_WEEKLY_LIMIT;
        return {
          playerId,
          limit,
          customLimit: limitById.get(playerId) ?? null,
          weeks: summarizeWeeks({
            items: items.get(playerId) ?? [],
            tournaments: tournaments
              .filter((t) => t.playerId === playerId)
              .map((t) => ({ start: t.startTime, end: t.endTime })),
            starts,
            limit,
            coachName,
            timeZone,
          }),
          duplicates: findDuplicates(
            openAssignments
              .filter((a) => a.playerId === playerId)
              .map((a) => ({
                lessonId: a.lessonId,
                lessonName: a.lesson.name,
                coachId: a.coachId,
              })),
            coachName,
          ),
          /** Open lessons of the player from other coaches (assign warning). */
          otherCoachLessons: openAssignments
            .filter((a) => a.playerId === playerId && a.coachId !== coachId)
            .map((a) => ({
              lessonId: a.lessonId,
              coach: coachName(a.coachId),
            })),
        };
      }),
    };
  }

  /** Any coach who works with the player sets the weekly limit. */
  async setLimit(coachId: string, playerId: string, minutes: unknown) {
    if (!(await coachCanSeePlayer(this.prisma, coachId, playerId))) {
      throw new ForbiddenException('Not your player');
    }
    let value: number | null = null;
    if (minutes !== null && minutes !== undefined && minutes !== '') {
      const parsed = Number(minutes);
      if (
        !Number.isInteger(parsed) ||
        parsed < MIN_LIMIT ||
        parsed > MAX_LIMIT
      ) {
        throw new BadRequestException(
          `minutes must be between ${MIN_LIMIT} and ${MAX_LIMIT}, or null`,
        );
      }
      value = parsed;
    }
    return this.prisma.user.update({
      where: { id: playerId },
      data: { weeklyLoadLimit: value },
      select: { id: true, weeklyLoadLimit: true },
    });
  }
}
