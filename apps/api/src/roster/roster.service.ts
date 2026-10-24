import { Injectable } from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentTargetType,
  CalendarTaskStatus,
  OwnerType,
} from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';
import { loadPlayerLearningSummaries } from '../assignments/assignment-lifecycle';
import {
  eventOccurrenceKey,
  loadAttendanceSummaries,
  slotOccurrenceKey,
  type AttendanceSummary,
} from '../calendar/attendance.service';
import {
  buildActivityDays,
  buildDayKeys,
  dayKey,
  expandOccurrences,
  nextOccurrence,
  resolveTimeZone,
  shiftDayKey,
} from './roster.helpers';

const PAST_DAYS = 6;
const FUTURE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const DONE_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.COMPLETED,
  AssignmentStatus.ARCHIVED,
];

/** Completed player lessons from this coach that the coach has not seen yet. */
export function feedbackWhere(coachId: string) {
  return {
    coachId,
    targetType: AssignmentTargetType.PLAYER,
    status: AssignmentStatus.COMPLETED,
    completedAt: { not: null },
    coachReviewedAt: null,
  };
}

function addToSetMap(
  map: Map<string, Set<string>>,
  key: string,
  value: string,
) {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

function latest(...dates: (Date | null | undefined)[]) {
  const times = dates
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime());
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

@Injectable()
export class RosterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything the coach home page needs in one call: the coach's teams with
   * plan / training-window info and every player the coach works with
   * (linked players plus members of the coach's teams).
   */
  async getRoster(coachId: string, requestedTimeZone?: string) {
    const timeZone = resolveTimeZone(
      requestedTimeZone,
      process.env.TZ || 'Europe/Berlin',
    );
    const now = new Date();
    const today = dayKey(now, timeZone);
    const dayKeys = buildDayKeys(today, PAST_DAYS, FUTURE_DAYS);
    // Generous UTC bounds around the visible days; exact bucketing uses dayKey.
    const rangeStart = new Date(now.getTime() - (PAST_DAYS + 2) * DAY_MS);
    const rangeEnd = new Date(now.getTime() + (FUTURE_DAYS + 2) * DAY_MS);
    const inRange = (date: Date) => {
      const key = dayKey(date, timeZone);
      return key >= dayKeys[0] && key <= dayKeys[dayKeys.length - 1];
    };

    const playerSelect = {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImage: true,
      phoneNumber: true,
      timezone: true,
      lastLogin: true,
      role: true,
      userClubs: {
        select: { clubId: true, club: { select: { id: true, name: true } } },
      },
      playerCoachLinks: {
        select: {
          role: true,
          coach: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    } as const;

    const [links, teams] = await Promise.all([
      this.prisma.coachPlayerLink.findMany({
        where: { coachId },
        select: { player: { select: playerSelect } },
      }),
      this.prisma.team.findMany({
        where: coachTeamsWhere(coachId),
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          coachId: true,
          coach: { select: { id: true, firstName: true, lastName: true } },
          staff: {
            orderBy: { createdAt: 'asc' },
            select: {
              role: true,
              coach: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          icon: true,
          shortName: true,
          description: true,
          category: true,
          clubId: true,
          members: {
            select: { userId: true, user: { select: playerSelect } },
          },
        },
      }),
    ]);

    type PlayerRecord = NonNullable<(typeof links)[number]['player']>;
    const playersById = new Map<
      string,
      { player: PlayerRecord; linked: boolean }
    >();
    for (const link of links) {
      if (link.player) {
        playersById.set(link.player.id, { player: link.player, linked: true });
      }
    }
    const teamIdsByPlayerId = new Map<string, Set<string>>();
    for (const team of teams) {
      for (const member of team.members) {
        if (!member.user || member.user.role !== 'PLAYER') continue;
        if (!playersById.has(member.userId)) {
          playersById.set(member.userId, {
            player: member.user,
            linked: false,
          });
        }
        addToSetMap(teamIdsByPlayerId, member.userId, team.id);
      }
    }

    const playerIds = [...playersById.keys()];
    const teamIds = teams.map((team) => team.id);

    // All memberships of these players (incl. other coaches' teams), so team
    // training windows show up in the activity strip.
    const allMemberships = playerIds.length
      ? await this.prisma.teamMember.findMany({
          where: { userId: { in: playerIds } },
          select: { userId: true, teamId: true },
        })
      : [];
    const anyTeamIdsByPlayerId = new Map<string, Set<string>>();
    for (const membership of allMemberships) {
      addToSetMap(anyTeamIdsByPlayerId, membership.userId, membership.teamId);
    }
    const anyTeamIds = [...new Set(allMemberships.map((m) => m.teamId))];

    const slotOwnerFilter = [
      ...(playerIds.length ? [{ playerId: { in: playerIds } }] : []),
      ...(anyTeamIds.length ? [{ teamId: { in: anyTeamIds } }] : []),
    ];

    const [
      learning,
      slots,
      tasks,
      recentCompletions,
      lastCompletions,
      tournaments,
      journeys,
      teamPlans,
    ] = await Promise.all([
      loadPlayerLearningSummaries(this.prisma, playerIds, { coachId }),
      slotOwnerFilter.length
        ? this.prisma.practiceSlot.findMany({
            where: { OR: slotOwnerFilter },
            select: {
              id: true,
              ownerType: true,
              playerId: true,
              teamId: true,
              title: true,
              startTime: true,
              endTime: true,
              recurrence: true,
              recurrenceEndDate: true,
            },
          })
        : [],
      slotOwnerFilter.length
        ? this.prisma.calendarTask.findMany({
            where: {
              practiceSlot: { OR: slotOwnerFilter },
              OR: [
                { scheduledDate: { gte: rangeStart, lte: rangeEnd } },
                { completedAt: { gte: rangeStart, lte: rangeEnd } },
              ],
            },
            select: {
              scheduledDate: true,
              status: true,
              completedAt: true,
              practiceSlot: { select: { playerId: true, teamId: true } },
            },
          })
        : [],
      playerIds.length
        ? this.prisma.lessonAssignment.findMany({
            where: {
              targetType: AssignmentTargetType.PLAYER,
              playerId: { in: playerIds },
              completedAt: { gte: rangeStart, lte: rangeEnd },
            },
            select: { playerId: true, completedAt: true },
          })
        : [],
      playerIds.length
        ? this.prisma.lessonAssignment.groupBy({
            by: ['playerId'],
            where: {
              targetType: AssignmentTargetType.PLAYER,
              playerId: { in: playerIds },
              completedAt: { not: null },
            },
            _max: { completedAt: true },
          })
        : [],
      playerIds.length
        ? this.prisma.tournament.findMany({
            where: { playerId: { in: playerIds }, endTime: { gte: now } },
            orderBy: { startTime: 'asc' },
            select: {
              playerId: true,
              title: true,
              location: true,
              startTime: true,
              endTime: true,
              priority: true,
            },
          })
        : [],
      playerIds.length
        ? this.prisma.journeyTemplateAssignment.findMany({
            where: {
              coachId,
              playerId: { in: playerIds },
              status: { notIn: DONE_STATUSES },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              playerId: true,
              playerPlanId: true,
              status: true,
              journeyTemplateId: true,
              journeyTemplate: { select: { name: true } },
            },
          })
        : [],
      teamIds.length
        ? this.prisma.playerDevelopmentPlan.findMany({
            where: {
              coachId,
              ownerType: OwnerType.TEAM,
              teamId: { in: teamIds },
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              teamId: true,
              startDate: true,
              endDate: true,
            },
          })
        : [],
    ]);

    const [feedbackCounts, noteCounts, teamEvents] = await Promise.all([
      playerIds.length
        ? this.prisma.lessonAssignment.groupBy({
            by: ['playerId'],
            where: { ...feedbackWhere(coachId), playerId: { in: playerIds } },
            _count: { _all: true },
          })
        : [],
      playerIds.length
        ? this.prisma.coachPlayerNote.groupBy({
            by: ['playerId'],
            // Own notes plus notes other coaches shared about the player.
            where: {
              playerId: { in: playerIds },
              OR: [{ coachId }, { visibility: 'SHARED' }],
            },
            _count: { _all: true },
          })
        : [],
      this.prisma.teamEvent.findMany({
        where: {
          teamId: { in: teamIds },
          startTime: { gte: rangeStart, lte: rangeEnd },
        },
        select: {
          id: true,
          title: true,
          location: true,
          startTime: true,
          endTime: true,
          teamId: true,
        },
      }),
    ]);
    const feedbackByPlayer = new Map(
      feedbackCounts.map((entry) => [entry.playerId, entry._count._all]),
    );
    const notesByPlayer = new Map(
      noteCounts.map((entry) => [entry.playerId, entry._count._all]),
    );

    // ── Journey progress (lessons of the journey's plan) ──────────────────
    const openJourneyIdsByPlayer = new Map<string, Set<string>>();
    for (const journey of journeys) {
      addToSetMap(
        openJourneyIdsByPlayer,
        journey.playerId,
        journey.journeyTemplateId,
      );
    }
    const currentJourneyByPlayer = new Map<string, (typeof journeys)[number]>();
    for (const journey of journeys) {
      if (!currentJourneyByPlayer.has(journey.playerId)) {
        currentJourneyByPlayer.set(journey.playerId, journey);
      }
    }
    const journeyPlanIds = [
      ...new Set(
        [...currentJourneyByPlayer.values()].map((j) => j.playerPlanId),
      ),
    ];
    const planLessons = journeyPlanIds.length
      ? await this.prisma.lessonAssignment.findMany({
          where: { block: { planId: { in: journeyPlanIds } } },
          select: {
            targetType: true,
            playerId: true,
            teamId: true,
            status: true,
            block: { select: { planId: true } },
          },
        })
      : [];

    // ── Activity strip inputs ────────────────────────────────────────────
    const completedDays = new Map<string, Set<string>>();
    const taskDays = new Map<string, Set<string>>();
    const windowDays = new Map<string, Set<string>>();

    for (const completion of recentCompletions) {
      if (
        completion.playerId &&
        completion.completedAt &&
        inRange(completion.completedAt)
      ) {
        addToSetMap(
          completedDays,
          completion.playerId,
          dayKey(completion.completedAt, timeZone),
        );
      }
    }

    const playersForSlot = (slot: {
      playerId: string | null;
      teamId: string | null;
    }) => {
      if (slot.playerId)
        return playersById.has(slot.playerId) ? [slot.playerId] : [];
      if (!slot.teamId) return [];
      return playerIds.filter((id) =>
        anyTeamIdsByPlayerId.get(id)?.has(slot.teamId as string),
      );
    };

    for (const task of tasks) {
      const owners = playersForSlot(task.practiceSlot);
      if (
        task.status === CalendarTaskStatus.COMPLETED &&
        task.completedAt &&
        inRange(task.completedAt)
      ) {
        const key = dayKey(task.completedAt, timeZone);
        // Team tasks have one shared status; only count them for player-owned slots.
        if (task.practiceSlot.playerId) {
          owners.forEach((id) => addToSetMap(completedDays, id, key));
        }
      }
      if (inRange(task.scheduledDate)) {
        const key = dayKey(task.scheduledDate, timeZone);
        owners.forEach((id) => addToSetMap(taskDays, id, key));
      }
    }

    for (const slot of slots) {
      const owners = playersForSlot(slot);
      if (owners.length === 0) continue;
      for (const occurrence of expandOccurrences(slot, rangeStart, rangeEnd)) {
        if (!inRange(occurrence.start)) continue;
        const key = dayKey(occurrence.start, timeZone);
        owners.forEach((id) => addToSetMap(windowDays, id, key));
      }
    }

    const lastCompletionByPlayer = new Map(
      lastCompletions.map((entry) => [entry.playerId, entry._max.completedAt]),
    );
    const nextTournamentByPlayer = new Map<
      string,
      (typeof tournaments)[number]
    >();
    for (const tournament of tournaments) {
      if (!nextTournamentByPlayer.has(tournament.playerId)) {
        nextTournamentByPlayer.set(tournament.playerId, tournament);
      }
    }

    const players = [...playersById.values()].map(({ player, linked }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { playerCoachLinks, role, ...data } = player;
      const playerTeamIds =
        teamIdsByPlayerId.get(player.id) ?? new Set<string>();
      const anyTeams = anyTeamIdsByPlayerId.get(player.id) ?? new Set<string>();

      const journey = currentJourneyByPlayer.get(player.id);
      let currentJourney: {
        name: string;
        status: string;
        completedLessons: number;
        totalLessons: number;
      } | null = null;
      if (journey) {
        const lessons = planLessons.filter((lesson) => {
          if (lesson.block?.planId !== journey.playerPlanId) return false;
          if (lesson.targetType === AssignmentTargetType.PLAYER) {
            return lesson.playerId === player.id;
          }
          return Boolean(lesson.teamId && anyTeams.has(lesson.teamId));
        });
        currentJourney = {
          name: journey.journeyTemplate.name,
          status: journey.status,
          completedLessons: lessons.filter((l) =>
            DONE_STATUSES.includes(l.status),
          ).length,
          totalLessons: lessons.length,
        };
      }

      const tournament = nextTournamentByPlayer.get(player.id);
      return {
        ...data,
        coaches: playerCoachLinks
          .filter((link) => link.coach)
          .map((link) => ({ ...link.coach, role: link.role })),
        /** This coach's role for the player (linked players only). */
        myRole:
          playerCoachLinks.find((link) => link.coach?.id === coachId)?.role ??
          null,
        linked,
        teamIds: [...playerTeamIds],
        learningProgress: learning[player.id],
        lastActivityAt: latest(
          player.lastLogin,
          lastCompletionByPlayer.get(player.id),
        ),
        days: buildActivityDays({
          dayKeys,
          today,
          completedDays: completedDays.get(player.id) ?? new Set(),
          taskDays: taskDays.get(player.id) ?? new Set(),
          windowDays: windowDays.get(player.id) ?? new Set(),
        }),
        currentJourney,
        feedbackCount: feedbackByPlayer.get(player.id) ?? 0,
        /** Journey templates from this coach the player has not finished yet. */
        openJourneyTemplateIds: [
          ...(openJourneyIdsByPlayer.get(player.id) ?? new Set<string>()),
        ],
        noteCount: notesByPlayer.get(player.id) ?? 0,
        nextTournament: tournament
          ? {
              title: tournament.title,
              location: tournament.location,
              startTime: tournament.startTime,
              endTime: tournament.endTime,
              priority: tournament.priority,
            }
          : null,
      };
    });

    const rosterTeams = teams.map((team) => {
      const teamSlots = slots.filter((slot) => slot.teamId === team.id);
      const next =
        teamSlots
          .map((slot) => {
            const occurrence = nextOccurrence(slot, now);
            return occurrence ? { title: slot.title, ...occurrence } : null;
          })
          .filter((value): value is NonNullable<typeof value> => value !== null)
          .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
      const memberIds = team.members
        .filter((member) => member.user?.role === 'PLAYER')
        .map((member) => member.userId);
      const isHeadCoach = team.coachId === coachId;
      return {
        id: team.id,
        coachId: team.coachId,
        isHeadCoach,
        myRole: isHeadCoach
          ? 'HEAD_COACH'
          : (team.staff.find((member) => member.coach.id === coachId)?.role ??
            null),
        staff: [{ role: 'HEAD_COACH', coach: team.coach }, ...team.staff].map(
          (member) => ({
            coachId: member.coach.id,
            firstName: member.coach.firstName,
            lastName: member.coach.lastName,
            role: member.role,
          }),
        ),
        icon: team.icon,
        shortName: team.shortName,
        description: team.description,
        category: team.category,
        clubId: team.clubId,
        memberIds,
        pendingLessons: memberIds.reduce(
          (sum, id) => sum + (learning[id]?.lessons.PENDING ?? 0),
          0,
        ),
        plans: teamPlans
          .filter((plan) => plan.teamId === team.id)
          .map((plan) => ({
            id: plan.id,
            name: plan.name,
            startDate: plan.startDate,
            endDate: plan.endDate,
          })),
        trainingWindowCount: teamSlots.length,
        nextTrainingWindow: next
          ? { title: next.title, start: next.start, end: next.end }
          : null,
      };
    });

    // ── Today: training windows and team events of today, tournaments this week.
    // "upcoming" lists the team sessions of the next 7 days with attendance,
    // so the coach sees early who is coming.
    const isToday = (date: Date) => dayKey(date, timeZone) === today;
    const upcomingLimit = shiftDayKey(today, 7);
    const isUpcoming = (date: Date) => {
      const key = dayKey(date, timeZone);
      return key > today && key <= upcomingLimit;
    };
    const coachTeamIds = new Set(teamIds);
    type AgendaItem = {
      kind: 'window' | 'event';
      title: string;
      start: Date;
      end: Date;
      location?: string | null;
      teamId?: string | null;
      playerId?: string | null;
      occurrenceKey?: string;
      attendance?: AttendanceSummary | null;
    };
    const agenda: AgendaItem[] = [];
    const upcoming: AgendaItem[] = [];
    for (const slot of slots) {
      const ownTeamSlot = slot.teamId && coachTeamIds.has(slot.teamId);
      const linkedPlayerSlot =
        slot.playerId && playersById.get(slot.playerId)?.linked;
      if (!ownTeamSlot && !linkedPlayerSlot) continue;
      for (const occurrence of expandOccurrences(slot, rangeStart, rangeEnd)) {
        const onToday = isToday(occurrence.start);
        if (!onToday && !(ownTeamSlot && isUpcoming(occurrence.start)))
          continue;
        (onToday ? agenda : upcoming).push({
          kind: 'window',
          title: slot.title,
          start: occurrence.start,
          end: occurrence.end,
          teamId: ownTeamSlot ? slot.teamId : null,
          playerId: ownTeamSlot ? null : slot.playerId,
          ...(ownTeamSlot
            ? { occurrenceKey: slotOccurrenceKey(slot.id, occurrence.start) }
            : {}),
        });
      }
    }
    for (const event of teamEvents) {
      const onToday = isToday(event.startTime);
      if (!onToday && !isUpcoming(event.startTime)) continue;
      (onToday ? agenda : upcoming).push({
        kind: 'event',
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        location: event.location,
        teamId: event.teamId,
        occurrenceKey: eventOccurrenceKey(event.id),
      });
    }
    agenda.sort((a, b) => a.start.getTime() - b.start.getTime());
    upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());
    upcoming.splice(5);

    const summaries = await loadAttendanceSummaries(
      this.prisma,
      [...agenda, ...upcoming]
        .filter((item) => item.occurrenceKey && item.teamId)
        .map((item) => ({
          key: item.occurrenceKey as string,
          teamId: item.teamId as string,
        })),
    );
    for (const item of [...agenda, ...upcoming]) {
      if (item.occurrenceKey) {
        item.attendance = summaries.get(item.occurrenceKey) ?? null;
      }
    }

    const weekLimit = shiftDayKey(today, 7);
    const tournamentsThisWeek = tournaments
      .filter(
        (tournament) => dayKey(tournament.startTime, timeZone) <= weekLimit,
      )
      .map((tournament) => ({
        playerId: tournament.playerId,
        title: tournament.title,
        location: tournament.location,
        startTime: tournament.startTime,
        endTime: tournament.endTime,
      }));

    return {
      timeZone,
      today,
      agenda,
      upcoming,
      tournamentsThisWeek,
      feedbackTotal: feedbackCounts.reduce(
        (sum, entry) => sum + entry._count._all,
        0,
      ),
      firstDay: dayKeys[0],
      lastDay: shiftDayKey(today, FUTURE_DAYS),
      teams: rosterTeams,
      players,
    };
  }
}
