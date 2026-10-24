import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';
import { AttendanceReminderService } from './attendance-reminder.service';
import { expandOccurrences } from '../roster/roster.helpers';
import {
  eventOccurrenceKey,
  loadAttendanceSummaries,
  slotOccurrenceKey,
  type AttendanceStatusValue,
} from './attendance.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Default window when the client does not send one. */
const DEFAULT_PAST_DAYS = 7;
const DEFAULT_FUTURE_DAYS = 60;
/** Longest range one request may ask for (a month view plus margins fits). */
const MAX_RANGE_DAYS = 200;

export type CoachAttendance = {
  going: number;
  maybe: number;
  notGoing: number;
  open: number;
  members: number;
  responses: {
    playerId: string;
    name: string;
    status: AttendanceStatusValue;
    note: string | null;
  }[];
  /** Team members without an answer yet. */
  openPlayers: { playerId: string; name: string }[];
};

export type CoachCalendarActivity = {
  id: string;
  sourceId: string;
  type: 'team-practice' | 'team-event' | 'coach-assignment' | 'tournament';
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  teamIcon?: string | null;
  description?: string | null;
  location?: string | null;
  /** Team trainings: the recurring series this occurrence belongs to. */
  recurrence?: string;
  occurrenceKey?: string;
  attendance?: CoachAttendance | null;
  /** Coach assignments: the session's lesson and who it is for. */
  lessonId?: string | null;
  focusArea?: string | null;
  durationMinutes?: number;
  status?: string;
  playerName?: string | null;
  priority?: string;
  /** Coach (or player) who created the entry. */
  createdById?: string | null;
  /** Team sessions: the last reminder sent to players without an answer. */
  lastReminder?: { sentAt: string; kind: string } | null;
};

function fullName(user: {
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email ||
    'Player'
  );
}

/** Parses the requested range; falls back to a sensible default window. */
export function resolveRange(
  fromValue: string | undefined,
  toValue: string | undefined,
  now = new Date(),
) {
  const from = fromValue
    ? new Date(fromValue)
    : new Date(now.getTime() - DEFAULT_PAST_DAYS * DAY_MS);
  const to = toValue
    ? new Date(toValue)
    : new Date(now.getTime() + DEFAULT_FUTURE_DAYS * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('from/to must be ISO dates');
  }
  if (from >= to) throw new BadRequestException('from must be before to');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new BadRequestException(
      `The range may span at most ${MAX_RANGE_DAYS} days`,
    );
  }
  return { from, to };
}

/**
 * The coach's calendar: trainings and events of the coach's teams with the
 * players' answers, the coach's scheduled sessions and tournaments of the
 * coach's players.
 */
@Injectable()
export class CoachCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: AttendanceReminderService,
  ) {}

  async getCalendar(
    coachId: string,
    role: string,
    query: { from?: string; to?: string; teamId?: string },
  ) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches have a coach calendar');
    }
    const { from, to } = resolveRange(query.from, query.to);

    const [allTeams, links] = await Promise.all([
      this.prisma.team.findMany({
        where: coachTeamsWhere(coachId),
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          shortName: true,
          icon: true,
          coachId: true,
          autoRemindHours: true,
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.coachPlayerLink.findMany({
        where: { coachId },
        select: { playerId: true },
      }),
    ]);
    if (query.teamId && !allTeams.some((team) => team.id === query.teamId)) {
      throw new ForbiddenException('Not your team');
    }
    const teams = query.teamId
      ? allTeams.filter((team) => team.id === query.teamId)
      : allTeams;
    const teamIds = teams.map((team) => team.id);
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const nameById = new Map<string, string>();
    for (const team of allTeams) {
      for (const member of team.members) {
        nameById.set(member.user.id, fullName(member.user));
      }
    }
    // Tournaments: linked players and members of the shown teams.
    const playerIds = query.teamId
      ? [...new Set(teams.flatMap((t) => t.members.map((m) => m.user.id)))]
      : [
          ...new Set([
            ...links.map((link) => link.playerId),
            ...teams.flatMap((t) => t.members.map((m) => m.user.id)),
          ]),
        ];

    const [slots, events, tasks, tournaments] = await Promise.all([
      teamIds.length
        ? this.prisma.practiceSlot.findMany({
            where: {
              ownerType: OwnerType.TEAM,
              teamId: { in: teamIds },
              startTime: { lte: to },
            },
          })
        : Promise.resolve([]),
      teamIds.length
        ? this.prisma.teamEvent.findMany({
            where: {
              teamId: { in: teamIds },
              endTime: { gte: from },
              startTime: { lte: to },
            },
            orderBy: { startTime: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.calendarTask.findMany({
        where: {
          scheduledDate: { gte: new Date(from.getTime() - DAY_MS), lte: to },
          OR: query.teamId
            ? [{ practiceSlot: { teamId: query.teamId } }]
            : [
                { coachId },
                ...(teamIds.length
                  ? [{ practiceSlot: { teamId: { in: teamIds } } }]
                  : []),
              ],
        },
        include: {
          lesson: { select: { id: true, focusArea: true } },
          practiceSlot: {
            select: {
              teamId: true,
              player: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { scheduledDate: 'asc' },
      }),
      playerIds.length
        ? this.prisma.tournament.findMany({
            where: {
              playerId: { in: playerIds },
              endTime: { gte: from },
              startTime: { lte: to },
            },
            include: {
              player: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const occurrences = slots.flatMap((slot) =>
      expandOccurrences(slot, from, to).map((occurrence) => ({
        slot,
        occurrence,
        key: slotOccurrenceKey(slot.id, occurrence.start),
      })),
    );

    const summaries = await loadAttendanceSummaries(this.prisma, [
      ...occurrences.map((item) => ({
        key: item.key,
        teamId: item.slot.teamId as string,
      })),
      ...events.map((event) => ({
        key: eventOccurrenceKey(event.id),
        teamId: event.teamId,
      })),
    ]);
    const attendanceFor = (
      key: string,
      teamId: string,
    ): CoachAttendance | null => {
      const summary = summaries.get(key);
      const team = teamById.get(teamId);
      if (!summary || !team) return null;
      const answered = new Set(summary.responses.map((r) => r.playerId));
      return {
        going: summary.going,
        maybe: summary.maybe,
        notGoing: summary.notGoing,
        open: summary.open,
        members: summary.members,
        responses: summary.responses.map((response) => ({
          ...response,
          name: nameById.get(response.playerId) ?? 'Player',
        })),
        openPlayers: team.members
          .filter((member) => !answered.has(member.user.id))
          .map((member) => ({
            playerId: member.user.id,
            name: fullName(member.user),
          })),
      };
    };

    const lastReminders = await this.reminders.lastReminders([
      ...occurrences.map((item) => item.key),
      ...events.map((event) => eventOccurrenceKey(event.id)),
    ]);
    const reminderFor = (key: string) => {
      const last = lastReminders.get(key);
      return last
        ? { sentAt: last.sentAt.toISOString(), kind: last.kind }
        : null;
    };

    const activities: CoachCalendarActivity[] = [];
    for (const { slot, occurrence, key } of occurrences) {
      const team = teamById.get(slot.teamId as string);
      activities.push({
        id: `slot-${slot.id}-${occurrence.start.toISOString()}`,
        sourceId: slot.id,
        type: 'team-practice',
        title: slot.title,
        start: occurrence.start.toISOString(),
        end: occurrence.end.toISOString(),
        teamId: slot.teamId,
        teamName: team?.shortName ?? null,
        teamIcon: team?.icon ?? null,
        recurrence: slot.recurrence,
        occurrenceKey: key,
        attendance: attendanceFor(key, slot.teamId as string),
        lastReminder: reminderFor(key),
      });
    }
    for (const event of events) {
      const team = teamById.get(event.teamId);
      const key = eventOccurrenceKey(event.id);
      activities.push({
        id: `team-event-${event.id}`,
        sourceId: event.id,
        type: 'team-event',
        title: event.title,
        start: event.startTime.toISOString(),
        end: event.endTime.toISOString(),
        teamId: event.teamId,
        teamName: team?.shortName ?? null,
        teamIcon: team?.icon ?? null,
        description: event.description,
        location: event.location,
        occurrenceKey: key,
        attendance: attendanceFor(key, event.teamId),
        lastReminder: reminderFor(key),
        createdById: event.coachId,
      });
    }
    for (const task of tasks) {
      const start = new Date(task.scheduledDate);
      const end = new Date(start.getTime() + task.durationMinutes * 60_000);
      if (end < from) continue;
      const teamId = task.practiceSlot.teamId;
      const team = teamId ? teamById.get(teamId) : undefined;
      activities.push({
        id: `task-${task.id}`,
        sourceId: task.id,
        type: 'coach-assignment',
        title: task.title,
        start: start.toISOString(),
        end: end.toISOString(),
        description: task.description,
        teamId,
        teamName: team?.shortName ?? null,
        teamIcon: team?.icon ?? null,
        playerName: task.practiceSlot.player
          ? fullName(task.practiceSlot.player)
          : null,
        lessonId: task.lesson?.id ?? null,
        focusArea: task.lesson?.focusArea ?? null,
        durationMinutes: task.durationMinutes,
        status: task.status,
        createdById: task.coachId,
      });
    }
    for (const tournament of tournaments) {
      activities.push({
        id: `tournament-${tournament.id}`,
        sourceId: tournament.id,
        type: 'tournament',
        title: tournament.title,
        start: tournament.startTime.toISOString(),
        end: tournament.endTime.toISOString(),
        description: tournament.description,
        location: tournament.location,
        playerName: fullName(tournament.player),
        priority: tournament.priority,
      });
    }
    activities.sort((a, b) => a.start.localeCompare(b.start));

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      teams: allTeams.map((team) => ({
        id: team.id,
        shortName: team.shortName,
        icon: team.icon,
        memberCount: team.members.length,
        autoRemindHours: team.autoRemindHours,
        /** Head coach: may change team settings. */
        isHeadCoach: role === 'ADMIN' || team.coachId === coachId,
      })),
      activities,
    };
  }
}
