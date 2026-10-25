import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { expandOccurrences } from '../roster/roster.helpers';
import { assertTeamAccess } from '../teams/team-access';
import { expandEffective, loadSlotExceptions } from './occurrences';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A week view plus margins; the finder never needs more. */
const MAX_RANGE_DAYS = 31;

export type BusyKind =
  | 'absence'
  | 'tournament'
  | 'team-training'
  | 'team-event';

export type BusyInterval = {
  start: string;
  end: string;
  kind: BusyKind;
  /** e.g. "School", "Club championship", "Training (U14)" */
  label: string;
  /** Absences: SCHOOL, WORK, HOLIDAY, TRAVEL, CUSTOM */
  absenceType?: string;
};

type Interval = { start: Date; end: Date } & Omit<
  BusyInterval,
  'start' | 'end'
>;

const ABSENCE_LABEL: Record<string, string> = {
  SCHOOL: 'School',
  WORK: 'Work',
  HOLIDAY: 'Holiday',
  TRAVEL: 'Travel',
  CUSTOM: 'Unavailable',
};

/** Clips to [from, to] and sorts; overlapping entries stay separate (labels). */
export function clipIntervals(intervals: Interval[], from: Date, to: Date) {
  return intervals
    .filter((interval) => interval.end > from && interval.start < to)
    .map((interval) => ({
      ...interval,
      start: interval.start < from ? from : interval.start,
      end: interval.end > to ? to : interval.end,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Team time finder: when are the players of a team busy? Absences (school,
 * work, holidays …), tournaments and the trainings and events of all their
 * teams. The client turns this into a heatmap of free times.
 */
@Injectable()
export class TeamAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(
    coachId: string,
    role: string,
    teamId: string,
    query: { from?: string; to?: string },
  ) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches use the time finder');
    }
    await assertTeamAccess(this.prisma, coachId, role, teamId);
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + 7 * DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be ISO dates');
    }
    if (from >= to) throw new BadRequestException('from must be before to');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new BadRequestException(
        `The range may span at most ${MAX_RANGE_DAYS} days`,
      );
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        shortName: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (!team) throw new ForbiddenException('Not your team');
    const players = team.members
      .map((member) => member.user)
      .filter((user) => user.role === 'PLAYER');
    const playerIds = players.map((player) => player.id);
    if (playerIds.length === 0) {
      return {
        team: { id: team.id, shortName: team.shortName },
        range: { from: from.toISOString(), to: to.toISOString() },
        members: [],
      };
    }

    // All teams of these players: their trainings and events keep them busy.
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: { in: playerIds } },
      select: {
        userId: true,
        teamId: true,
        team: { select: { shortName: true } },
      },
    });
    const teamIds = [...new Set(memberships.map((m) => m.teamId))];
    const teamName = new Map(
      memberships.map((m) => [m.teamId, m.team.shortName]),
    );

    const [blocks, tournaments, slots, events] = await Promise.all([
      this.prisma.availabilityBlock.findMany({
        where: { playerId: { in: playerIds }, startTime: { lte: to } },
        select: {
          playerId: true,
          title: true,
          type: true,
          startTime: true,
          endTime: true,
          recurrence: true,
          recurrenceEndDate: true,
        },
      }),
      this.prisma.tournament.findMany({
        where: {
          playerId: { in: playerIds },
          endTime: { gte: from },
          startTime: { lte: to },
        },
        select: { playerId: true, title: true, startTime: true, endTime: true },
      }),
      this.prisma.practiceSlot.findMany({
        where: {
          ownerType: OwnerType.TEAM,
          teamId: { in: teamIds },
          startTime: { lte: to },
        },
        select: {
          id: true,
          teamId: true,
          title: true,
          startTime: true,
          endTime: true,
          recurrence: true,
          recurrenceEndDate: true,
        },
      }),
      this.prisma.teamEvent.findMany({
        where: {
          teamId: { in: teamIds },
          endTime: { gte: from },
          startTime: { lte: to },
        },
        select: { teamId: true, title: true, startTime: true, endTime: true },
      }),
    ]);
    const exceptions = await loadSlotExceptions(
      this.prisma,
      slots.map((slot) => slot.id),
    );

    const busy = new Map<string, Interval[]>(playerIds.map((id) => [id, []]));
    const add = (playerId: string, interval: Interval) =>
      busy.get(playerId)?.push(interval);

    for (const block of blocks) {
      for (const occurrence of expandOccurrences(block, from, to)) {
        add(block.playerId, {
          ...occurrence,
          kind: 'absence',
          label: block.title || ABSENCE_LABEL[block.type] || 'Unavailable',
          absenceType: block.type,
        });
      }
    }
    for (const tournament of tournaments) {
      add(tournament.playerId, {
        start: tournament.startTime,
        end: tournament.endTime,
        kind: 'tournament',
        label: tournament.title,
      });
    }
    const playersOfTeam = (id: string) =>
      memberships.filter((m) => m.teamId === id).map((m) => m.userId);
    const withTeam = (title: string, id: string) => {
      const name = teamName.get(id);
      return name && !title.toLowerCase().includes(name.toLowerCase())
        ? `${title} (${name})`
        : title;
    };
    for (const slot of slots) {
      const occurrences = expandEffective(
        slot,
        exceptions.get(slot.id),
        from,
        to,
      ).filter((occurrence) => occurrence.status !== 'cancelled');
      for (const playerId of playersOfTeam(slot.teamId as string)) {
        for (const occurrence of occurrences) {
          add(playerId, {
            start: occurrence.start,
            end: occurrence.end,
            kind: 'team-training',
            label: withTeam(slot.title, slot.teamId as string),
          });
        }
      }
    }
    for (const event of events) {
      for (const playerId of playersOfTeam(event.teamId)) {
        add(playerId, {
          start: event.startTime,
          end: event.endTime,
          kind: 'team-event',
          label: withTeam(event.title, event.teamId),
        });
      }
    }

    return {
      team: { id: team.id, shortName: team.shortName },
      range: { from: from.toISOString(), to: to.toISOString() },
      members: players.map((player) => ({
        playerId: player.id,
        name:
          [player.firstName, player.lastName].filter(Boolean).join(' ') ||
          player.email,
        busy: clipIntervals(busy.get(player.id) ?? [], from, to).map(
          (interval): BusyInterval => ({
            ...interval,
            start: interval.start.toISOString(),
            end: interval.end.toISOString(),
          }),
        ),
      })),
    };
  }
}
