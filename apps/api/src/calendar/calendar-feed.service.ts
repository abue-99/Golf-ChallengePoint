import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';
import { expandEffective, loadSlotExceptions } from './occurrences';
import { formatSession } from './reminder-mail';
import { CalendarService } from './calendar.service';
import { buildIcs, type IcsEvent } from './ics';
import {
  eventOccurrenceKey,
  loadAttendanceSummaries,
  slotOccurrenceKey,
} from './attendance.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The feed covers the last 30 days and the next 6 months. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 183;
const UID_DOMAIN = 'golf-challengepoint.com';
const DEFAULT_TIME_ZONE = 'Europe/Berlin';

const ANSWER_LABEL: Record<string, string> = {
  GOING: 'You are going',
  MAYBE: 'You answered maybe',
  NOT_GOING: 'You are not going',
};

function validTimeZone(value: string | null | undefined) {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** "Training (U16)" – unless the title already names the team. */
function withTeam(title: string, team?: string | null) {
  if (!team || title.toLowerCase().includes(team.toLowerCase())) return title;
  return `${title} (${team})`;
}

/** "Moved from Tue 27 Oct, 16:00–17:30" / "Cancelled – <reason>". */
export function changeLine(
  occurrence: {
    status: string;
    originalStart: Date;
    originalEnd: Date;
    reason?: string | null;
  },
  timeZone: string,
) {
  if (occurrence.status === 'cancelled') {
    return `Cancelled${occurrence.reason ? ` – ${occurrence.reason}` : ''}`;
  }
  if (occurrence.status === 'moved') {
    const was = formatSession(
      occurrence.originalStart,
      occurrence.originalEnd,
      timeZone,
    );
    return `Moved from ${was}${occurrence.reason ? ` – ${occurrence.reason}` : ''}`;
  }
  return null;
}

function newToken() {
  return randomBytes(24).toString('base64url');
}

/**
 * Calendar subscription: each user gets a secret URL that Apple Calendar,
 * Outlook or Google Calendar poll. Read-only, so a token in the URL is the
 * usual trade-off; the user can replace it at any time.
 */
@Injectable()
export class CalendarFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
  ) {}

  async getOrCreate(userId: string) {
    const existing = await this.prisma.calendarFeedToken.findUnique({
      where: { userId },
      select: { token: true, lastAccessedAt: true, createdAt: true },
    });
    if (existing) return existing;
    return this.prisma.calendarFeedToken.create({
      data: { userId, token: newToken() },
      select: { token: true, lastAccessedAt: true, createdAt: true },
    });
  }

  /** New secret URL; the old one stops working immediately. */
  async rotate(userId: string) {
    return this.prisma.calendarFeedToken.upsert({
      where: { userId },
      create: { userId, token: newToken() },
      update: { token: newToken(), lastAccessedAt: null },
      select: { token: true, lastAccessedAt: true, createdAt: true },
    });
  }

  async renderFeed(token: string) {
    const record = await this.prisma.calendarFeedToken.findUnique({
      where: { token },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            timezone: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Calendar feed not found');

    // Fire and forget: shows the user that the subscription is in use.
    void this.prisma.calendarFeedToken
      .update({
        where: { id: record.id },
        data: { lastAccessedAt: new Date() },
      })
      .catch(() => undefined);

    const user = record.user;
    const timeZone = validTimeZone(user.timezone);
    const role = user.role as string;
    const events =
      role === 'PLAYER'
        ? await this.playerEvents(user.id, timeZone)
        : await this.coachEvents(user.id, timeZone);

    return buildIcs({
      name: `ChallengePoint – ${user.firstName ?? 'My calendar'}`,
      timeZone,
      events,
    });
  }

  private range() {
    const now = Date.now();
    return {
      from: new Date(now - PAST_DAYS * DAY_MS),
      to: new Date(now + FUTURE_DAYS * DAY_MS),
    };
  }

  /** The player's own calendar, the same data as the in-app calendar. */
  private async playerEvents(
    playerId: string,
    timeZone: string,
  ): Promise<IcsEvent[]> {
    const { from, to } = this.range();
    const calendar = await this.calendar.getPlayerCalendar(
      playerId,
      'PLAYER',
      playerId,
    );
    const answers = await this.prisma.attendance.findMany({
      where: { playerId },
      select: { occurrenceKey: true, status: true },
    });
    const answerByKey = new Map(
      answers.map((answer) => [answer.occurrenceKey, answer.status as string]),
    );

    const events: IcsEvent[] = [];
    for (const raw of calendar.activities) {
      const activity = raw as {
        id: string;
        type: string;
        title: string;
        start: string;
        end: string;
        allDay?: boolean;
        description?: string | null;
        location?: string | null;
        teamName?: string | null;
        occurrenceKey?: string;
        planName?: string;
        occurrenceStatus?: 'moved' | 'cancelled';
        originalStart?: string;
        originalEnd?: string;
        changeReason?: string | null;
      };
      // Availability blocks are the player's own entries (school, work …)
      // and lesson due dates are tasks, not appointments.
      if (
        activity.type === 'availability-block' ||
        activity.type === 'lesson-mission'
      ) {
        continue;
      }
      const start = new Date(activity.start);
      const end = new Date(activity.end);
      if (end < from || start > to) continue;

      const cancelled = activity.occurrenceStatus === 'cancelled';
      const answer =
        activity.occurrenceKey && !cancelled
          ? answerByKey.get(activity.occurrenceKey)
          : undefined;
      const change =
        activity.occurrenceStatus && activity.originalStart
          ? changeLine(
              {
                status: activity.occurrenceStatus,
                originalStart: new Date(activity.originalStart),
                originalEnd: new Date(
                  activity.originalEnd ?? activity.originalStart,
                ),
                reason: activity.changeReason,
              },
              timeZone,
            )
          : null;
      const details = [
        activity.teamName ? `Team: ${activity.teamName}` : null,
        change,
        activity.planName ? `Plan: ${activity.planName}` : null,
        answer ? ANSWER_LABEL[answer] : null,
        activity.description ?? null,
      ].filter(Boolean);

      events.push({
        uid: `${activity.id}@${UID_DOMAIN}`,
        title: `${cancelled ? 'Cancelled: ' : ''}${withTeam(activity.title, activity.teamName)}`,
        start,
        end,
        allDay: activity.allDay || activity.type === 'milestone',
        description: details.join('\n') || null,
        location: activity.location ?? null,
        status:
          cancelled || answer === 'NOT_GOING'
            ? 'CANCELLED'
            : answer === 'MAYBE'
              ? 'TENTATIVE'
              : 'CONFIRMED',
      });
    }
    return events;
  }

  /**
   * Coach feed: training windows and events of the coach's teams (with the
   * current attendance), the coach's scheduled sessions and the tournaments
   * of linked players.
   */
  private async coachEvents(
    coachId: string,
    timeZone: string,
  ): Promise<IcsEvent[]> {
    const { from, to } = this.range();
    const [teams, links] = await Promise.all([
      this.prisma.team.findMany({
        where: coachTeamsWhere(coachId),
        select: { id: true, shortName: true },
      }),
      this.prisma.coachPlayerLink.findMany({
        where: { coachId },
        select: { playerId: true },
      }),
    ]);
    const teamIds = teams.map((team) => team.id);
    const teamName = new Map(teams.map((team) => [team.id, team.shortName]));
    const playerIds = links.map((link) => link.playerId);

    const [slots, teamEvents, tasks, tournaments] = await Promise.all([
      teamIds.length
        ? this.prisma.practiceSlot.findMany({
            where: { ownerType: OwnerType.TEAM, teamId: { in: teamIds } },
          })
        : Promise.resolve([]),
      teamIds.length
        ? this.prisma.teamEvent.findMany({
            where: {
              teamId: { in: teamIds },
              endTime: { gte: from },
              startTime: { lte: to },
            },
          })
        : Promise.resolve([]),
      this.prisma.calendarTask.findMany({
        where: { coachId, scheduledDate: { gte: from, lte: to } },
        include: {
          practiceSlot: {
            select: {
              team: { select: { shortName: true } },
              player: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      playerIds.length
        ? this.prisma.tournament.findMany({
            where: {
              playerId: { in: playerIds },
              endTime: { gte: from },
              startTime: { lte: to },
            },
            include: {
              player: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const exceptions = await loadSlotExceptions(
      this.prisma,
      slots.map((slot) => slot.id),
    );
    const occurrences = slots.flatMap((slot) =>
      expandEffective(slot, exceptions.get(slot.id), from, to).map(
        (occurrence) => ({
          slot,
          occurrence,
          key: slotOccurrenceKey(slot.id, occurrence.start),
        }),
      ),
    );
    // Attendance only for the coming weeks; past answers do not matter here.
    const now = new Date();
    const summaries = await loadAttendanceSummaries(this.prisma, [
      ...occurrences
        .filter(
          (item) =>
            item.occurrence.end >= now &&
            item.occurrence.status !== 'cancelled',
        )
        .map((item) => ({ key: item.key, teamId: item.slot.teamId as string })),
      ...teamEvents
        .filter((event) => event.endTime >= now)
        .map((event) => ({
          key: eventOccurrenceKey(event.id),
          teamId: event.teamId,
        })),
    ]);
    const attendanceLine = (key: string) => {
      const summary = summaries.get(key);
      if (!summary || summary.members === 0) return null;
      return `Attendance: ${summary.going} going, ${summary.maybe} maybe, ${summary.notGoing} not going, ${summary.open} open`;
    };

    const events: IcsEvent[] = [];
    for (const { slot, occurrence, key } of occurrences) {
      const team = slot.teamId ? teamName.get(slot.teamId) : undefined;
      const cancelled = occurrence.status === 'cancelled';
      events.push({
        // Series time: a moved occurrence updates the same calendar entry.
        uid: `slot-${slot.id}-${occurrence.originalStart.toISOString()}@${UID_DOMAIN}`,
        title: `${cancelled ? 'Cancelled: ' : ''}${withTeam(slot.title, team)}`,
        start: occurrence.start,
        end: occurrence.end,
        status: cancelled ? 'CANCELLED' : 'CONFIRMED',
        description: [
          team ? `Team: ${team}` : null,
          changeLine(occurrence, timeZone),
          cancelled ? null : attendanceLine(key),
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
    for (const event of teamEvents) {
      const team = teamName.get(event.teamId);
      events.push({
        uid: `team-event-${event.id}@${UID_DOMAIN}`,
        title: withTeam(event.title, team),
        start: event.startTime,
        end: event.endTime,
        location: event.location,
        description: [
          team ? `Team: ${team}` : null,
          attendanceLine(eventOccurrenceKey(event.id)),
          event.description,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
    for (const task of tasks) {
      const start = new Date(task.scheduledDate);
      const who =
        task.practiceSlot.team?.shortName ??
        [
          task.practiceSlot.player?.firstName,
          task.practiceSlot.player?.lastName,
        ]
          .filter(Boolean)
          .join(' ');
      events.push({
        uid: `task-${task.id}@${UID_DOMAIN}`,
        title: who ? `${task.title} – ${who}` : task.title,
        start,
        end: new Date(start.getTime() + task.durationMinutes * 60_000),
        description: task.description,
      });
    }
    for (const tournament of tournaments) {
      const name = [tournament.player.firstName, tournament.player.lastName]
        .filter(Boolean)
        .join(' ');
      events.push({
        uid: `tournament-${tournament.id}@${UID_DOMAIN}`,
        title: `🏆 ${name}: ${tournament.title}`,
        start: tournament.startTime,
        end: tournament.endTime,
        location: tournament.location,
        description: tournament.description,
      });
    }
    return events;
  }
}
