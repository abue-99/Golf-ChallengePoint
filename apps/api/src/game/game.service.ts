import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AssignmentStatus, Prisma } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { dayKey, resolveTimeZone } from '../roster/roster.helpers';
import { zonedDayStart } from '../roster/player-load';
import {
  addDays,
  BADGES,
  cardAttributes,
  DEFAULT_WEEKLY_GOAL,
  earnedBadges,
  EVENT,
  levelForXp,
  missionStars,
  missionXp,
  PRACTICE_EVENTS,
  questProgress,
  reviewXp,
  splitExercises,
  starsValue,
  weekOf,
  weeklyQuests,
  weeklyStreak,
  WEIGHT,
  XP,
  type BadgeStats,
  type QuestWeekStats,
  type RatingPoint,
} from './game-rules';

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

type NewEvent = {
  playerId: string;
  type: string;
  refKey: string;
  refId?: string | null;
  title?: string | null;
  xp?: number;
  actorId?: string | null;
  meta?: Prisma.InputJsonValue;
  createdAt?: Date;
};

export type GameOutcome = {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: { key: string; title: string; emoji: string }[];
  questsDone: string[];
  weekGoalReached: boolean;
  events: { type: string; title: string | null; xp: number }[];
};

type ActivityEventRow = NonNullable<Awaited<ReturnType<GameService['record']>>>;

type SyncCtx = {
  add: (event: NewEvent) => Promise<ActivityEventRow | null>;
  differs: (
    type: string,
    refKey: string,
    next: { xp?: number; meta?: unknown; actorId?: string | null },
  ) => boolean;
};

export type GameState = Awaited<ReturnType<GameService['computeState']>>;

const DONE: AssignmentStatus[] = [
  AssignmentStatus.COMPLETED,
  AssignmentStatus.ARCHIVED,
];

function isUniqueViolation(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

function personName(
  person:
    | { firstName: string | null; lastName: string | null }
    | null
    | undefined,
) {
  if (!person) return '';
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

/**
 * The player game: XP ledger (activity_events), levels, weekly streak,
 * quests, badges and the player card. `sync()` derives all events from the
 * real data, so it is idempotent and repairs anything a hook missed.
 */
@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  /** Players whose last-week podium was already checked in this process. */
  private readonly podiumChecked = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  private reminderTimer: ReturnType<typeof setInterval> | null = null;
  private readonly remindedWeeks = new Set<string>();

  onModuleInit() {
    if (
      process.env.GAME_STREAK_REMIND === 'off' ||
      process.env.NODE_ENV === 'test'
    )
      return;
    this.reminderTimer = setInterval(
      () => {
        void this.remindWeeklyGoal().catch((err: unknown) =>
          this.logger.warn(`Weekly goal reminder failed: ${String(err)}`),
        );
      },
      20 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  /**
   * Saturday 10–11 am (player time): push "weekly goal in reach" to players
   * with a device who practised in the last 4 weeks but miss the goal.
   */
  async remindWeeklyGoal(now = new Date()) {
    const subscribers = await this.prisma.pushSubscription.findMany({
      where: { user: { role: 'PLAYER' } },
      select: { userId: true, user: { select: { timezone: true } } },
      distinct: ['userId'],
    });
    for (const { userId, user } of subscribers) {
      const timeZone = resolveTimeZone(user.timezone, DEFAULT_TIME_ZONE);
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const weekday = parts.find((part) => part.type === 'weekday')?.value;
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      if (weekday !== 'Sat' || hour !== 10) continue;
      const week = weekOf(dayKey(now, timeZone));
      const memo = `${userId}:${week}`;
      if (this.remindedWeeks.has(memo)) continue;
      this.remindedWeeks.add(memo);
      const recent = await this.prisma.activityEvent.count({
        where: {
          playerId: userId,
          type: { in: PRACTICE_EVENTS },
          createdAt: { gte: new Date(now.getTime() - 28 * 86_400_000) },
        },
      });
      if (recent === 0) continue;
      const state = await this.computeState(userId, timeZone);
      if (state.week.reachedThisWeek) continue;
      const missing = state.week.goal - state.week.thisWeekDays.length;
      if (missing > 2) continue;
      this.push.notify([userId], 'streak', {
        title:
          state.week.weekStreak > 0
            ? `🔥 Keep your ${state.week.weekStreak}-week streak alive`
            : '🔥 Your weekly goal is in reach',
        body: `${missing} more practice day${missing === 1 ? '' : 's'} this weekend and you hit your goal.`,
        url: '/player',
        tag: `streak-${week}`,
      });
    }
  }

  // ── Basics ─────────────────────────────────────────────────────────

  async timeZoneOf(userId: string, requested?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return resolveTimeZone(requested || user?.timezone, DEFAULT_TIME_ZONE);
  }

  async ensureProfile(userId: string) {
    const existing = await this.prisma.playerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) return;
    await this.prisma.playerProfile
      .create({
        data: { userId, name: personName(user) || user.email },
      })
      .catch((err: unknown) => {
        if (!isUniqueViolation(err)) throw err;
      });
  }

  /** Creates the event unless it exists already (unique per player/type/refKey). */
  async record(event: NewEvent) {
    try {
      return await this.prisma.activityEvent.create({
        data: {
          playerId: event.playerId,
          type: event.type,
          refKey: event.refKey,
          refId: event.refId ?? null,
          title: event.title ?? null,
          xp: event.xp ?? 0,
          actorId: event.actorId ?? null,
          meta: event.meta,
          ...(event.createdAt ? { createdAt: event.createdAt } : {}),
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  /** Runs `sync` and swallows errors – for hooks in other services. */
  syncQuietly(playerId: string | null | undefined) {
    if (!playerId) return;
    void this.sync(playerId).catch((err: unknown) =>
      this.logger.warn(
        `Game sync failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  // ── Sync: derive events from the data ──────────────────────────────

  /**
   * Derives all events from lessons, plans, calendar sessions, team
   * sessions, answers, reviews and challenges, then awards week goal,
   * quests, badges, podiums and level-ups. Returns the new events.
   */
  async sync(
    playerId: string,
  ): Promise<GameOutcome & { state: GameState | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: playerId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'PLAYER') {
      return {
        xpGained: 0,
        levelBefore: 1,
        levelAfter: 1,
        newBadges: [],
        questsDone: [],
        weekGoalReached: false,
        events: [],
        state: null,
      };
    }
    await this.ensureProfile(playerId);

    const [existingRows, timeZone] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: { playerId },
        select: {
          type: true,
          refKey: true,
          xp: true,
          meta: true,
          actorId: true,
        },
      }),
      this.timeZoneOf(playerId),
    ]);
    const before = existingRows.reduce((sum, row) => sum + row.xp, 0);
    const existing = new Map(
      existingRows.map((row) => [`${row.type}|${row.refKey}`, row]),
    );
    const created: ActivityEventRow[] = [];
    const ctx: SyncCtx = {
      add: async (event) => {
        const key = `${event.type}|${event.refKey}`;
        if (existing.has(key)) return null;
        const row = await this.record(event);
        existing.set(key, {
          type: event.type,
          refKey: event.refKey,
          xp: event.xp ?? 0,
          meta: (event.meta ?? null) as Prisma.JsonValue,
          actorId: event.actorId ?? null,
        });
        if (row) created.push(row);
        return row;
      },
      differs: (type, refKey, next) => {
        const row = existing.get(`${type}|${refKey}`);
        if (!row) return false;
        if (next.xp !== undefined && next.xp !== row.xp) return true;
        if (next.actorId !== undefined && next.actorId !== row.actorId)
          return true;
        if (
          next.meta !== undefined &&
          JSON.stringify(next.meta) !== JSON.stringify(row.meta)
        ) {
          return true;
        }
        return false;
      },
    };

    await Promise.all([
      this.deriveLessonEvents(playerId, ctx),
      this.deriveJourneyEvents(playerId, ctx),
      this.deriveSessionEvents(playerId, ctx),
      this.deriveTeamEvents(playerId, ctx),
      this.deriveMessageEvents(playerId, ctx),
      this.deriveChallengeEvents(playerId, ctx),
      this.deriveReviewEvents(playerId, ctx),
    ]);
    await this.derivePodiums(playerId, timeZone, ctx);

    // Rewards that depend on the totals; repeat while something new came in
    // (badges add XP, XP adds levels …).
    let weekGoalReached = false;
    const questsDone: string[] = [];
    let state = await this.computeState(playerId, timeZone);
    for (let round = 0; round < 3; round += 1) {
      const count = created.length;
      if (state.week.reachedThisWeek) {
        const row = await ctx.add({
          playerId,
          type: EVENT.WEEK_GOAL,
          refKey: state.week.week,
          title: `Weekly goal: ${state.week.goal} practice days`,
          xp: XP.weekGoal,
        });
        if (row) weekGoalReached = true;
      }
      for (const quest of state.quests.filter((item) => item.done)) {
        const row = await ctx.add({
          playerId,
          type: EVENT.QUEST_COMPLETED,
          refKey: `${state.week.week}:${quest.key}`,
          title: quest.title,
          xp: XP.quest,
        });
        if (row) questsDone.push(quest.title);
      }
      for (const badge of state.badges.filter(
        (item) => item.earned && !item.earnedAt,
      )) {
        await ctx.add({
          playerId,
          type: EVENT.BADGE_EARNED,
          refKey: badge.key,
          title: `${badge.emoji} ${badge.title}`,
          xp: XP.badge,
          meta: { badge: badge.key },
        });
      }
      for (let level = 2; level <= state.level.level; level += 1) {
        await ctx.add({
          playerId,
          type: EVENT.LEVEL_UP,
          refKey: `L${level}`,
          title: `Reached level ${level}`,
          meta: { level },
        });
      }
      if (created.length === count) break;
      state = await this.computeState(playerId, timeZone);
    }

    const after = state.level.xp;
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: playerId },
      select: {
        xp: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
      },
    });
    if (
      !profile ||
      profile.xp !== after ||
      profile.level !== state.level.level ||
      profile.currentStreak !== state.week.weekStreak ||
      profile.longestStreak !== state.week.bestWeekStreak ||
      created.length
    ) {
      await this.prisma.playerProfile.update({
        where: { userId: playerId },
        data: {
          xp: after,
          level: state.level.level,
          currentStreak: state.week.weekStreak,
          longestStreak: state.week.bestWeekStreak,
          ...(created.length ? { lastActivityAt: new Date() } : {}),
        },
      });
    }

    // Coaches who switched it on get a push for fresh mission results.
    for (const row of created) {
      if (row.type !== EVENT.LESSON_COMPLETED) continue;
      if (Date.now() - row.createdAt.getTime() > 10 * 60_000) continue;
      const meta = (row.meta ?? {}) as { coachId?: string; stars?: number };
      if (!meta.coachId) continue;
      const player = await this.prisma.user.findUnique({
        where: { id: playerId },
        select: { firstName: true, lastName: true },
      });
      this.push.notify([meta.coachId], 'activity', {
        title: `✅ ${personName(player) || 'A player'} completed a mission`,
        body: `${row.title ?? ''} ${'⭐'.repeat(meta.stars ?? 0)}`.trim(),
        url: '/dashboard',
        tag: `done-${row.refKey}`,
      });
    }
    const badgeByKey = new Map(BADGES.map((badge) => [badge.key, badge]));
    return {
      xpGained: after - before,
      levelBefore: levelForXp(before).level,
      levelAfter: state.level.level,
      newBadges: created
        .filter((row) => row.type === EVENT.BADGE_EARNED)
        .map((row) => badgeByKey.get(row.refKey))
        .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge))
        .map((badge) => ({
          key: badge.key,
          title: badge.title,
          emoji: badge.emoji,
        })),
      questsDone,
      weekGoalReached,
      events: created.map((row) => ({
        type: row.type,
        title: row.title,
        xp: row.xp,
      })),
      state,
    };
  }

  async totalXp(playerId: string) {
    const sum = await this.prisma.activityEvent.aggregate({
      where: { playerId },
      _sum: { xp: true },
    });
    return sum._sum.xp ?? 0;
  }

  private async deriveLessonEvents(playerId: string, ctx: SyncCtx) {
    const assignments = await this.prisma.lessonAssignment.findMany({
      where: {
        playerId,
        OR: [
          { status: { in: DONE } },
          { status: AssignmentStatus.IN_PROGRESS },
        ],
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
        updatedAt: true,
        stars: true,
        resultScore: true,
        practiceMinutes: true,
        exercisesDone: true,
        coachId: true,
        lesson: {
          select: {
            name: true,
            focusArea: true,
            durationMinutes: true,
            plannedExercises: true,
            targetScore: true,
          },
        },
        block: {
          select: {
            id: true,
            name: true,
            plan: { select: { id: true, name: true } },
          },
        },
      },
    });
    for (const assignment of assignments) {
      if (assignment.status === AssignmentStatus.IN_PROGRESS) {
        await ctx.add({
          playerId,
          type: EVENT.LESSON_STARTED,
          refKey: assignment.id,
          refId: assignment.id,
          title: assignment.lesson.name,
          meta: { focusArea: assignment.lesson.focusArea },
          createdAt: assignment.updatedAt,
        });
        continue;
      }
      const stars =
        assignment.stars ??
        missionStars({
          resultScore: assignment.resultScore,
          targetScore: assignment.lesson.targetScore,
          exerciseCount: splitExercises(assignment.lesson.plannedExercises)
            .length,
          exercisesDone: assignment.exercisesDone.length,
          practiceMinutes: assignment.practiceMinutes,
          durationMinutes: assignment.lesson.durationMinutes,
        });
      await ctx.add({
        playerId,
        type: EVENT.LESSON_COMPLETED,
        refKey: assignment.id,
        refId: assignment.id,
        title: assignment.lesson.name,
        xp: missionXp(assignment.lesson.durationMinutes, stars),
        meta: {
          focusArea: assignment.lesson.focusArea,
          stars,
          plan: assignment.block?.plan?.name ?? null,
          coachId: assignment.coachId,
        },
        createdAt: assignment.completedAt ?? assignment.updatedAt,
      });
    }
  }

  private async deriveJourneyEvents(playerId: string, ctx: SyncCtx) {
    const plans = await this.prisma.playerDevelopmentPlan.findMany({
      where: { playerId },
      select: {
        id: true,
        name: true,
        blocks: {
          select: {
            id: true,
            name: true,
            assignments: {
              where: { playerId },
              select: { status: true, completedAt: true },
            },
          },
        },
      },
    });
    const latest = (dates: (Date | null)[]) =>
      dates.reduce<Date | undefined>(
        (max, date) => (date && (!max || date > max) ? date : max),
        undefined,
      );
    for (const plan of plans) {
      let planTotal = 0;
      let planDone = 0;
      const planDates: (Date | null)[] = [];
      for (const block of plan.blocks) {
        const total = block.assignments.length;
        const done = block.assignments.filter((a) =>
          DONE.includes(a.status),
        ).length;
        planTotal += total;
        planDone += done;
        planDates.push(...block.assignments.map((a) => a.completedAt));
        if (total > 0 && done === total && plan.blocks.length > 1) {
          await ctx.add({
            playerId,
            type: EVENT.BLOCK_COMPLETED,
            refKey: block.id,
            refId: block.id,
            title: `${plan.name} · ${block.name}`,
            xp: XP.block,
            createdAt: latest(block.assignments.map((a) => a.completedAt)),
          });
        }
      }
      if (planTotal > 0 && planDone === planTotal) {
        await ctx.add({
          playerId,
          type: EVENT.JOURNEY_COMPLETED,
          refKey: plan.id,
          refId: plan.id,
          title: plan.name,
          xp: XP.journey,
          createdAt: latest(planDates),
        });
      }
    }
    const accepted = await this.prisma.journeyTemplateAssignment.findMany({
      where: { playerId, status: { not: AssignmentStatus.NEW } },
      select: {
        id: true,
        updatedAt: true,
        coachId: true,
        journeyTemplate: { select: { name: true } },
      },
    });
    for (const journey of accepted) {
      await ctx.add({
        playerId,
        type: EVENT.JOURNEY_ACCEPTED,
        refKey: journey.id,
        refId: journey.id,
        title: journey.journeyTemplate.name,
        xp: XP.journeyAccepted,
        meta: { coachId: journey.coachId },
        createdAt: journey.updatedAt,
      });
    }
  }

  /** Calendar sessions the player ticked off in their own practice slots. */
  private async deriveSessionEvents(playerId: string, ctx: SyncCtx) {
    const tasks = await this.prisma.calendarTask.findMany({
      where: {
        status: 'COMPLETED',
        practiceSlot: { playerId },
        // Lessons with an assignment already count as a mission.
        assignmentId: null,
      },
      select: {
        id: true,
        title: true,
        completedAt: true,
        updatedAt: true,
        durationMinutes: true,
      },
    });
    for (const task of tasks) {
      await ctx.add({
        playerId,
        type: EVENT.SESSION_COMPLETED,
        refKey: task.id,
        refId: task.id,
        title: task.title,
        xp: XP.session,
        meta: { minutes: task.durationMinutes },
        createdAt: task.completedAt ?? task.updatedAt,
      });
    }
  }

  /** Answers to team sessions and team sessions attended ("Going", over). */
  private async deriveTeamEvents(playerId: string, ctx: SyncCtx) {
    const attendances = await this.prisma.attendance.findMany({
      where: { playerId },
      select: {
        occurrenceKey: true,
        occurrenceStart: true,
        status: true,
        createdAt: true,
        practiceSlot: {
          select: {
            title: true,
            teamId: true,
            team: { select: { shortName: true } },
          },
        },
        teamEvent: {
          select: {
            title: true,
            teamId: true,
            team: { select: { shortName: true } },
          },
        },
      },
    });
    const now = Date.now();
    for (const attendance of attendances) {
      const source = attendance.practiceSlot ?? attendance.teamEvent;
      const title = source?.title ?? 'Team session';
      const meta = {
        status: attendance.status,
        teamId: source?.teamId ?? null,
        team: source?.team?.shortName ?? null,
        start: attendance.occurrenceStart.toISOString(),
      };
      const row = await ctx.add({
        playerId,
        type: EVENT.ATTENDANCE_ANSWERED,
        refKey: attendance.occurrenceKey,
        title,
        xp: XP.attendance,
        meta,
        createdAt: attendance.createdAt,
      });
      if (
        !row &&
        ctx.differs(EVENT.ATTENDANCE_ANSWERED, attendance.occurrenceKey, {
          meta,
        })
      ) {
        // Keep the latest answer visible in the coach feed.
        await this.prisma.activityEvent.updateMany({
          where: {
            playerId,
            type: EVENT.ATTENDANCE_ANSWERED,
            refKey: attendance.occurrenceKey,
          },
          data: { meta },
        });
      }
      if (
        attendance.status === 'GOING' &&
        attendance.occurrenceStart.getTime() < now &&
        attendance.practiceSlot
      ) {
        await ctx.add({
          playerId,
          type: EVENT.TEAM_SESSION,
          refKey: attendance.occurrenceKey,
          title,
          xp: XP.teamSession,
          meta,
          createdAt: attendance.occurrenceStart,
        });
      }
    }
  }

  /** Coach questions the player answered (a player message after the question). */
  private async deriveMessageEvents(playerId: string, ctx: SyncCtx) {
    const conversations = await this.prisma.conversation.findMany({
      where: { playerId },
      select: { id: true, coachId: true },
    });
    for (const conversation of conversations) {
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId: conversation.id,
          OR: [{ isQuestion: true }, { senderId: playerId }],
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          isQuestion: true,
          senderId: true,
          body: true,
          createdAt: true,
        },
        take: 500,
      });
      let open: (typeof messages)[number] | null = null;
      for (const message of messages) {
        if (message.isQuestion && message.senderId !== playerId) {
          open = message;
        } else if (open && message.senderId === playerId) {
          await ctx.add({
            playerId,
            type: EVENT.QUESTION_ANSWERED,
            refKey: open.id,
            refId: open.id,
            title: open.body.slice(0, 120),
            xp: XP.question,
            actorId: conversation.coachId,
            createdAt: message.createdAt,
          });
          open = null;
        }
      }
    }
  }

  private async deriveChallengeEvents(playerId: string, ctx: SyncCtx) {
    const entries = await this.prisma.challengeEntry.findMany({
      where: { playerId },
      orderBy: { createdAt: 'asc' },
      select: {
        challengeId: true,
        score: true,
        createdAt: true,
        challenge: {
          select: {
            title: true,
            unit: true,
            teamId: true,
            higherIsBetter: true,
          },
        },
      },
    });
    const best = new Map<string, number>();
    for (const entry of entries) {
      const previous = best.get(entry.challengeId);
      const better =
        previous === undefined ||
        (entry.challenge.higherIsBetter
          ? entry.score > previous
          : entry.score < previous);
      if (better) best.set(entry.challengeId, entry.score);
    }
    for (const entry of entries) {
      const meta = {
        best: best.get(entry.challengeId) ?? entry.score,
        unit: entry.challenge.unit,
        teamId: entry.challenge.teamId,
      };
      const row = await ctx.add({
        playerId,
        type: EVENT.CHALLENGE_ENTRY,
        refKey: entry.challengeId,
        refId: entry.challengeId,
        title: entry.challenge.title,
        xp: XP.challenge,
        meta,
        createdAt: entry.createdAt,
      });
      if (
        !row &&
        ctx.differs(EVENT.CHALLENGE_ENTRY, entry.challengeId, { meta })
      ) {
        await this.prisma.activityEvent.updateMany({
          where: {
            playerId,
            type: EVENT.CHALLENGE_ENTRY,
            refKey: entry.challengeId,
          },
          data: { meta },
        });
      }
    }
  }

  /** Coach reviews: XP follows the current rating (a changed review updates it). */
  private async deriveReviewEvents(playerId: string, ctx: SyncCtx) {
    const reviewed = await this.prisma.lessonAssignment.findMany({
      where: { playerId, coachRating: { not: null } },
      select: {
        id: true,
        coachRating: true,
        coachComment: true,
        coachPick: true,
        reviewedAt: true,
        reviewedById: true,
        lesson: { select: { name: true, focusArea: true } },
      },
    });
    for (const assignment of reviewed) {
      const xp = reviewXp(assignment.coachRating ?? 0, assignment.coachPick);
      const meta = {
        rating: assignment.coachRating,
        pick: assignment.coachPick,
        focusArea: assignment.lesson.focusArea,
        comment: assignment.coachComment
          ? assignment.coachComment.slice(0, 200)
          : null,
      };
      const row = await ctx.add({
        playerId,
        type: EVENT.COACH_REVIEW,
        refKey: assignment.id,
        refId: assignment.id,
        title: assignment.lesson.name,
        xp,
        actorId: assignment.reviewedById,
        meta,
        createdAt: assignment.reviewedAt ?? undefined,
      });
      if (
        !row &&
        ctx.differs(EVENT.COACH_REVIEW, assignment.id, {
          xp,
          meta,
          actorId: assignment.reviewedById,
        })
      ) {
        await this.prisma.activityEvent.updateMany({
          where: { playerId, type: EVENT.COACH_REVIEW, refKey: assignment.id },
          data: { xp, meta, actorId: assignment.reviewedById },
        });
      }
    }
  }

  /** Top 3 of last week's team league (teams with the game switched on). */
  private async derivePodiums(
    playerId: string,
    timeZone: string,
    ctx: SyncCtx,
  ) {
    const lastWeek = addDays(weekOf(dayKey(new Date(), timeZone)), -7);
    const memo = `${playerId}:${lastWeek}`;
    if (this.podiumChecked.has(memo)) return;
    this.podiumChecked.add(memo);
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: playerId, team: { gameEnabled: true } },
      select: { team: { select: { id: true, shortName: true } } },
    });
    for (const { team } of memberships) {
      const ranking = await this.leagueRanking(team.id, lastWeek, timeZone);
      const index = ranking.findIndex((row) => row.playerId === playerId);
      if (index < 0 || index > 2 || ranking[index].xp <= 0) continue;
      await ctx.add({
        playerId,
        type: EVENT.LEAGUE_PODIUM,
        refKey: `${team.id}:${lastWeek}`,
        title: `#${index + 1} in the ${team.shortName} league`,
        xp: XP.podium[index],
        meta: { rank: index + 1, teamId: team.id, week: lastWeek },
      });
    }
  }

  /** Weekly XP per member, highest first (ties keep name order). */
  async leagueRanking(teamId: string, week: string, timeZone: string) {
    const from = zonedDayStart(week, timeZone);
    const to = zonedDayStart(addDays(week, 7), timeZone);
    const members = await this.prisma.teamMember.findMany({
      where: { teamId, user: { role: 'PLAYER' } },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });
    const ids = members.map((member) => member.user.id);
    if (ids.length === 0) return [];
    const sums = await this.prisma.activityEvent.groupBy({
      by: ['playerId'],
      where: {
        playerId: { in: ids },
        createdAt: { gte: from, lt: to },
        // Podium rewards don't feed the next league.
        type: { not: EVENT.LEAGUE_PODIUM },
      },
      _sum: { xp: true },
    });
    const xpById = new Map(sums.map((row) => [row.playerId, row._sum.xp ?? 0]));
    return members
      .map((member) => ({
        playerId: member.user.id,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        profileImage: member.user.profileImage,
        xp: xpById.get(member.user.id) ?? 0,
      }))
      .sort(
        (a, b) => b.xp - a.xp || personName(a).localeCompare(personName(b)),
      );
  }

  // ── State for the player screens ───────────────────────────────────

  async computeState(playerId: string, timeZone: string) {
    const now = new Date();
    const today = dayKey(now, timeZone);
    const week = weekOf(today);
    const weekStart = zonedDayStart(week, timeZone);

    const [
      user,
      events,
      completed,
      tournaments,
      holidays,
      entries,
      teamCount,
      activeChallenges,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: playerId },
        select: { weeklyGoalDays: true },
      }),
      this.prisma.activityEvent.findMany({
        where: { playerId },
        select: {
          type: true,
          refKey: true,
          xp: true,
          createdAt: true,
          meta: true,
        },
      }),
      this.prisma.lessonAssignment.findMany({
        where: { playerId, status: { in: DONE } },
        select: {
          completedAt: true,
          updatedAt: true,
          reviewedAt: true,
          coachRating: true,
          coachPick: true,
          selfAssessment: true,
          playerNotes: true,
          stars: true,
          practiceMinutes: true,
          lesson: { select: { focusArea: true, durationMinutes: true } },
        },
      }),
      this.prisma.tournament.findMany({
        where: { playerId },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.availabilityBlock.findMany({
        where: {
          playerId,
          type: { in: ['HOLIDAY', 'TRAVEL'] },
          recurrence: 'NONE',
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.challengeEntry.findMany({
        where: {
          playerId,
          challenge: { isBenchmark: true, targetScore: { gt: 0 } },
        },
        select: {
          score: true,
          createdAt: true,
          challenge: {
            select: {
              focusArea: true,
              targetScore: true,
              higherIsBetter: true,
            },
          },
        },
      }),
      this.prisma.teamMember.count({
        where: { userId: playerId, team: { gameEnabled: true } },
      }),
      this.prisma.teamChallenge.count({
        // Only challenges that existed when the week began, so the quests
        // stay the same all week.
        where: {
          team: { gameEnabled: true, members: { some: { userId: playerId } } },
          createdAt: { lte: weekStart },
          endsAt: { gte: weekStart },
        },
      }),
    ]);

    const xp = events.reduce((sum, event) => sum + event.xp, 0);
    const level = levelForXp(xp);

    // Weekly streak
    const practiceDays = events
      .filter((event) => PRACTICE_EVENTS.includes(event.type))
      .map((event) => dayKey(event.createdAt, timeZone));
    const protectedWeeks = new Set<string>();
    for (const range of tournaments) {
      for (
        let day = dayKey(range.startTime, timeZone);
        day <= dayKey(range.endTime, timeZone);
        day = addDays(day, 1)
      ) {
        protectedWeeks.add(weekOf(day));
        if (protectedWeeks.size > 500) break;
      }
    }
    for (const range of holidays) {
      const perWeek = new Map<string, number>();
      let guard = 0;
      for (
        let day = dayKey(range.startTime, timeZone);
        day <= dayKey(range.endTime, timeZone) && guard < 400;
        day = addDays(day, 1)
      ) {
        perWeek.set(weekOf(day), (perWeek.get(weekOf(day)) ?? 0) + 1);
        guard += 1;
      }
      for (const [key, days] of perWeek) if (days >= 4) protectedWeeks.add(key);
    }
    const streak = weeklyStreak({
      practiceDays,
      protectedWeeks,
      goal: user?.weeklyGoalDays ?? DEFAULT_WEEKLY_GOAL,
      today,
    });

    // Player card
    const points: RatingPoint[] = [];
    const completedByArea: Record<string, number> = {};
    for (const item of completed) {
      const area = item.lesson.focusArea;
      const at = item.completedAt ?? item.updatedAt;
      completedByArea[area] = (completedByArea[area] ?? 0) + 1;
      if (item.coachRating) {
        points.push({
          area,
          value: item.coachRating * 20,
          weight: WEIGHT.coach,
          at: item.reviewedAt ?? at,
        });
      }
      if (item.stars)
        points.push({
          area,
          value: starsValue(item.stars),
          weight: WEIGHT.stars,
          at,
        });
      if (item.selfAssessment) {
        points.push({
          area,
          value: Math.min(10, item.selfAssessment) * 10,
          weight: WEIGHT.self,
          at,
        });
      }
    }
    for (const entry of entries) {
      const target = entry.challenge.targetScore ?? 0;
      if (!entry.challenge.focusArea || target <= 0) continue;
      const ratio = entry.challenge.higherIsBetter
        ? entry.score / target
        : entry.score > 0
          ? target / entry.score
          : 1;
      points.push({
        area: entry.challenge.focusArea,
        value: Math.max(0, Math.min(100, Math.round(ratio * 100))),
        weight: WEIGHT.benchmark,
        at: entry.createdAt,
      });
    }
    const card = cardAttributes({ points, completedByArea });
    const day = 86_400_000;
    const history = [
      {
        key: 'lastMonth',
        label: 'Last month',
        asOf: new Date(now.getTime() - 30 * day),
      },
      {
        key: 'lastQuarter',
        label: 'Last quarter',
        asOf: new Date(now.getTime() - 91 * day),
      },
      {
        key: 'lastYear',
        label: 'Last year',
        asOf: new Date(now.getTime() - 365 * day),
      },
    ].map((preset) => {
      const asOfCount: Record<string, number> = {};
      for (const item of completed) {
        if ((item.completedAt ?? item.updatedAt) <= preset.asOf) {
          asOfCount[item.lesson.focusArea] =
            (asOfCount[item.lesson.focusArea] ?? 0) + 1;
        }
      }
      const past = cardAttributes({
        points,
        completedByArea: asOfCount,
        asOf: preset.asOf,
      });
      return {
        key: preset.key,
        label: preset.label,
        ovr: past.ovr,
        attributes: past.attributes,
      };
    });

    // Badges
    const countType = (type: string) =>
      events.filter((event) => event.type === type).length;
    const lessonEvents = events.filter(
      (event) => event.type === EVENT.LESSON_COMPLETED,
    );
    const missionsByArea: Record<string, number> = {};
    let threeStar = 0;
    let earlyBird = false;
    for (const event of lessonEvents) {
      const meta = (event.meta ?? {}) as { focusArea?: string; stars?: number };
      if (meta.focusArea)
        missionsByArea[meta.focusArea] =
          (missionsByArea[meta.focusArea] ?? 0) + 1;
      if ((meta.stars ?? 0) >= 3) threeStar += 1;
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hour: '2-digit',
          hour12: false,
        }).format(event.createdAt),
      );
      if (hour >= 4 && hour < 8) earlyBird = true;
    }
    const stats: BadgeStats = {
      missions: lessonEvents.length,
      threeStarMissions: threeStar,
      journeysCompleted: countType(EVENT.JOURNEY_COMPLETED),
      coachPicks: completed.filter((item) => item.coachPick).length,
      bestWeekStreak: streak.bestWeekStreak,
      level: level.level,
      attendanceAnswers: countType(EVENT.ATTENDANCE_ANSWERED),
      questionsAnswered: countType(EVENT.QUESTION_ANSWERED),
      challengesEntered: countType(EVENT.CHALLENGE_ENTRY),
      earlyBird,
      missionsByArea,
      podiums: countType(EVENT.LEAGUE_PODIUM),
    };
    const earned = new Set(earnedBadges(stats));
    const earnedAt = new Map(
      events
        .filter((event) => event.type === EVENT.BADGE_EARNED)
        .map((event) => [event.refKey, event.createdAt] as const),
    );
    const badges = BADGES.map((badge) => {
      const progress = badge.progress(stats);
      return {
        key: badge.key,
        title: badge.title,
        description: badge.description,
        emoji: badge.emoji,
        value: progress.value,
        target: progress.target,
        earned: earned.has(badge.key) || earnedAt.has(badge.key),
        earnedAt: earnedAt.get(badge.key) ?? null,
      };
    });

    // Quests of this week
    const inWeek = (date: Date) => date >= weekStart;
    const weekEvents = events.filter((event) => inWeek(event.createdAt));
    const weekCompleted = completed.filter((item) =>
      inWeek(item.completedAt ?? item.updatedAt),
    );
    const questStats: QuestWeekStats = {
      missions: weekEvents.filter(
        (event) => event.type === EVENT.LESSON_COMPLETED,
      ).length,
      threeStars: weekEvents.filter(
        (event) =>
          event.type === EVENT.LESSON_COMPLETED &&
          ((event.meta ?? {}) as { stars?: number }).stars === 3,
      ).length,
      practiceMinutes:
        weekCompleted.reduce(
          (sum, item) =>
            sum + (item.practiceMinutes ?? item.lesson.durationMinutes),
          0,
        ) +
        weekEvents
          .filter((event) => event.type === EVENT.SESSION_COMPLETED)
          .reduce(
            (sum, event) =>
              sum + (((event.meta ?? {}) as { minutes?: number }).minutes ?? 0),
            0,
          ),
      attendanceAnswers: weekEvents.filter(
        (event) => event.type === EVENT.ATTENDANCE_ANSWERED,
      ).length,
      reflections: weekCompleted.filter(
        (item) => item.selfAssessment && item.playerNotes?.trim(),
      ).length,
      challengeEntries: weekEvents.filter(
        (event) => event.type === EVENT.CHALLENGE_ENTRY,
      ).length,
    };
    const questDefs = weeklyQuests(week, {
      inTeam: teamCount > 0,
      hasChallenge: activeChallenges > 0,
    });
    const doneQuestKeys = new Set(
      events
        .filter(
          (event) =>
            event.type === EVENT.QUEST_COMPLETED &&
            event.refKey.startsWith(`${week}:`),
        )
        .map((event) => event.refKey.slice(week.length + 1)),
    );
    const quests = questProgress(questDefs, questStats).map((quest) => ({
      key: quest.key,
      title: quest.title,
      emoji: quest.emoji,
      value: quest.value,
      target: quest.target,
      done: quest.done || doneQuestKeys.has(quest.key),
      xp: quest.xp,
    }));

    return {
      today,
      timeZone,
      level,
      week: streak,
      card: { ...card, tier: level.tier, history },
      badges,
      quests,
      stats,
    };
  }

  /** Everything the player home / "Me" screen needs. */
  async me(playerId: string, requestedTimeZone?: string) {
    const synced = await this.sync(playerId);
    const timeZone = await this.timeZoneOf(playerId, requestedTimeZone);
    const state =
      synced.state && synced.state.timeZone === timeZone
        ? synced.state
        : await this.computeState(playerId, timeZone);
    const [user, recent, newReviews] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: playerId },
        select: {
          firstName: true,
          lastName: true,
          profileImage: true,
          playerProfile: { select: { handicap: true } },
        },
      }),
      this.prisma.activityEvent.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          type: true,
          title: true,
          xp: true,
          createdAt: true,
          meta: true,
          actor: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.lessonAssignment.count({
        where: {
          playerId,
          coachRating: { not: null },
          playerSeenReviewAt: null,
        },
      }),
    ]);
    return {
      player: {
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        profileImage: user?.profileImage ?? null,
        handicap: user?.playerProfile?.handicap ?? null,
      },
      ...state,
      newReviews,
      recent,
    };
  }

  async setWeeklyGoal(playerId: string, days: unknown) {
    const value = typeof days === 'number' ? Math.round(days) : Number.NaN;
    if (!Number.isFinite(value) || value < 1 || value > 7) {
      throw new BadRequestException('Weekly goal must be 1–7 days');
    }
    await this.prisma.user.update({
      where: { id: playerId },
      data: { weeklyGoalDays: value },
    });
    return { weeklyGoalDays: value };
  }

  /** Legacy shape for /gamification/:userId. */
  async legacyProfile(playerId: string) {
    await this.sync(playerId).catch(() => null);
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: playerId },
      select: {
        xp: true,
        currentStreak: true,
        longestStreak: true,
        lastActivityAt: true,
      },
    });
    if (!profile) return null;
    const level = levelForXp(profile.xp);
    return {
      ...profile,
      level: level.level,
      levelProgress: level.progress,
      nextLevelXp: level.nextLevelXp - level.levelStartXp,
    };
  }

  /**
   * "New mission/journey from <coach>" push to players (fire and forget).
   * `target` is a list of players or a team (all its players).
   */
  notifyNewWork(
    coachId: string,
    target: { playerIds?: string[]; teamId?: string },
    work: { lessonId?: string; journeyId?: string },
  ) {
    void (async () => {
      const [coach, lesson, journey, members] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: coachId },
          select: { firstName: true },
        }),
        work.lessonId
          ? this.prisma.trainingLesson.findUnique({
              where: { id: work.lessonId },
              select: { name: true },
            })
          : null,
        work.journeyId
          ? this.prisma.journeyTemplate.findUnique({
              where: { id: work.journeyId },
              select: { name: true },
            })
          : null,
        target.teamId
          ? this.prisma.teamMember.findMany({
              where: { teamId: target.teamId, user: { role: 'PLAYER' } },
              select: { userId: true },
            })
          : [],
      ]);
      const ids = [
        ...(target.playerIds ?? []),
        ...members.map((member) => member.userId),
      ];
      const what = journey
        ? `journey “${journey.name}”`
        : lesson
          ? `mission “${lesson.name}”`
          : 'mission';
      this.push.notify(ids, 'assignments', {
        title: `🎯 New ${journey ? 'journey' : 'mission'} from ${coach?.firstName ?? 'your coach'}`,
        body: `Your coach sent you the ${what}. Accept it and start playing!`,
        url: '/dashboard',
        tag: `new-${work.journeyId ?? work.lessonId ?? 'work'}`,
      });
    })().catch((err: unknown) =>
      this.logger.warn(
        `Push failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  /** Push helper used by other services. */
  notify(...args: Parameters<PushService['notify']>) {
    this.push.notify(...args);
  }
}
