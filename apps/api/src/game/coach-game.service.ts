import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, Prisma } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertHeadCoach,
  assertTeamAccess,
  coachCanSeePlayer,
  coachTeamsWhere,
} from '../teams/team-access';
import { GameService } from './game.service';
import { EVENT, FOCUS_AREAS, levelForXp, weekOf } from './game-rules';
import { dayKey } from '../roster/roster.helpers';
import { bestEntries } from './team-game.service';

const PERSON = {
  select: { id: true, firstName: true, lastName: true, profileImage: true },
} as const;
const MAX_COMMENT = 2000;

/** Types coaches see in "Recent activity" (quests and auto levels are noise). */
export const COACH_FEED_TYPES: string[] = [
  EVENT.LESSON_STARTED,
  EVENT.LESSON_COMPLETED,
  EVENT.BLOCK_COMPLETED,
  EVENT.JOURNEY_COMPLETED,
  EVENT.JOURNEY_ACCEPTED,
  EVENT.SESSION_COMPLETED,
  EVENT.ATTENDANCE_ANSWERED,
  EVENT.QUESTION_ANSWERED,
  EVENT.COACH_REVIEW,
  EVENT.CHALLENGE_ENTRY,
  EVENT.BADGE_EARNED,
  EVENT.WEEK_GOAL,
  EVENT.LEAGUE_PODIUM,
];

function name(
  person: { firstName: string | null; lastName: string | null } | null,
) {
  return person
    ? [person.firstName, person.lastName].filter(Boolean).join(' ')
    : '';
}

/** Coach side: reviews, activity feed, player card, challenges, team switch. */
@Injectable()
export class CoachGameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GameService,
  ) {}

  private requireCoach(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches can do this');
    }
  }

  /** Linked players plus members of the coach's teams. */
  async visiblePlayerIds(coachId: string) {
    const [links, members] = await Promise.all([
      this.prisma.coachPlayerLink.findMany({
        where: { coachId },
        select: { playerId: true },
      }),
      this.prisma.teamMember.findMany({
        where: { team: coachTeamsWhere(coachId), user: { role: 'PLAYER' } },
        select: { userId: true },
      }),
    ]);
    return [
      ...new Set([
        ...links.map((l) => l.playerId),
        ...members.map((m) => m.userId),
      ]),
    ];
  }

  // ── Review ─────────────────────────────────────────────────────────

  async review(
    coachId: string,
    role: string,
    assignmentId: string,
    body: { rating?: unknown; comment?: unknown; pick?: unknown },
  ) {
    this.requireCoach(role);
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        coachId: true,
        playerId: true,
        status: true,
        coachRating: true,
        lesson: { select: { name: true } },
      },
    });
    if (!assignment || !assignment.playerId)
      throw new NotFoundException('Lesson not found');
    if (
      assignment.coachId !== coachId &&
      role !== 'ADMIN' &&
      !(await coachCanSeePlayer(this.prisma, coachId, assignment.playerId))
    ) {
      throw new ForbiddenException('This player is not one of your players');
    }
    if (
      assignment.status !== AssignmentStatus.COMPLETED &&
      assignment.status !== AssignmentStatus.ARCHIVED
    ) {
      throw new BadRequestException('Only completed lessons can be reviewed');
    }
    const rating =
      typeof body?.rating === 'number' ? Math.round(body.rating) : Number.NaN;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be 1–5 stars');
    }
    let comment: string | null = null;
    if (body?.comment !== undefined && body.comment !== null) {
      if (typeof body.comment !== 'string')
        throw new BadRequestException('Comment must be text');
      comment = body.comment.trim().slice(0, MAX_COMMENT) || null;
    }
    const pick = body?.pick === true;
    const now = new Date();
    const updated = await this.prisma.lessonAssignment.update({
      where: { id: assignmentId },
      data: {
        coachRating: rating,
        coachComment: comment,
        coachPick: pick,
        reviewedById: coachId,
        reviewedAt: now,
        coachReviewedAt: now,
        playerSeenReviewAt: null,
      },
      select: {
        id: true,
        coachRating: true,
        coachComment: true,
        coachPick: true,
        reviewedAt: true,
        reviewedBy: PERSON,
      },
    });
    await this.game.sync(assignment.playerId);
    const coach = await this.prisma.user.findUnique({
      where: { id: coachId },
      select: { firstName: true },
    });
    this.game.notify([assignment.playerId], 'reviews', {
      title: `${'⭐'.repeat(rating)} ${coach?.firstName ?? 'Your coach'} reviewed your mission`,
      body: comment
        ? `${assignment.lesson.name}: ${comment}`
        : assignment.lesson.name,
      url: '/dashboard?reviews=1',
      tag: `review-${assignmentId}`,
    });
    return {
      id: updated.id,
      rating: updated.coachRating,
      comment: updated.coachComment,
      pick: updated.coachPick,
      at: updated.reviewedAt,
      by: updated.reviewedBy,
    };
  }

  // ── Activity feed ──────────────────────────────────────────────────

  async feed(
    coachId: string,
    role: string,
    query: { before?: string; playerId?: string; limit?: string },
  ) {
    this.requireCoach(role);
    let playerIds = await this.visiblePlayerIds(coachId);
    if (query.playerId) {
      if (!playerIds.includes(query.playerId)) {
        throw new ForbiddenException('This player is not one of your players');
      }
      playerIds = [query.playerId];
    }
    const before = query.before ? new Date(query.before) : null;
    if (before && Number.isNaN(before.getTime())) {
      throw new BadRequestException('before must be an ISO date');
    }
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 30));
    const coach = await this.prisma.user.findUnique({
      where: { id: coachId },
      select: { feedSeenAt: true },
    });
    // Without a "seen" mark, the last three days count as new.
    const seenAt = coach?.feedSeenAt ?? new Date(Date.now() - 3 * 86_400_000);
    const where: Prisma.ActivityEventWhereInput = {
      playerId: { in: playerIds },
      type: { in: COACH_FEED_TYPES },
      ...(before ? { createdAt: { lt: before } } : {}),
    };
    const noteWhere: Prisma.CoachPlayerNoteWhereInput = {
      playerId: { in: playerIds },
      coachId: { not: coachId },
      visibility: 'SHARED',
      OR: [{ mentionIds: { has: coachId } }, { isHandover: true }],
    };
    const [events, notes, unreadEvents, unreadNotes] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          type: true,
          refId: true,
          title: true,
          xp: true,
          meta: true,
          createdAt: true,
          player: PERSON,
          actor: PERSON,
        },
      }),
      this.prisma.coachPlayerNote.findMany({
        where: {
          ...noteWhere,
          ...(before ? { createdAt: { lt: before } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          body: true,
          isHandover: true,
          mentionIds: true,
          createdAt: true,
          player: PERSON,
          coach: PERSON,
        },
      }),
      this.prisma.activityEvent.count({
        where: {
          playerId: { in: playerIds },
          type: { in: COACH_FEED_TYPES },
          // Own reviews are not news for oneself.
          OR: [{ actorId: null }, { actorId: { not: coachId } }],
          createdAt: { gt: seenAt },
        },
      }),
      this.prisma.coachPlayerNote.count({
        where: { ...noteWhere, createdAt: { gt: seenAt } },
      }),
    ]);
    const lessonIds = events
      .filter((event) => event.type === EVENT.LESSON_COMPLETED && event.refId)
      .map((event) => event.refId as string);
    const lessons = lessonIds.length
      ? await this.prisma.lessonAssignment.findMany({
          where: { id: { in: lessonIds } },
          select: {
            id: true,
            coachId: true,
            status: true,
            selfAssessment: true,
            playerNotes: true,
            coachRating: true,
            stars: true,
            resultScore: true,
            lesson: { select: { targetScore: true, targetAttempts: true } },
          },
        })
      : [];
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const eventItems = events.map((event) => {
      const lesson = event.refId ? lessonById.get(event.refId) : undefined;
      return {
        id: event.id,
        type: event.type,
        title: event.title,
        xp: event.xp,
        meta: event.meta,
        createdAt: event.createdAt,
        player: event.player,
        actor: event.actor,
        unread: event.createdAt > seenAt && event.actor?.id !== coachId,
        lesson:
          event.type === EVENT.LESSON_COMPLETED && lesson
            ? {
                assignmentId: lesson.id,
                mine: lesson.coachId === coachId,
                selfAssessment: lesson.selfAssessment,
                notes: lesson.playerNotes,
                stars: lesson.stars,
                resultScore: lesson.resultScore,
                targetScore: lesson.lesson.targetScore,
                targetAttempts: lesson.lesson.targetAttempts,
                reviewed: lesson.coachRating != null,
                stillCompleted:
                  lesson.status === AssignmentStatus.COMPLETED ||
                  lesson.status === AssignmentStatus.ARCHIVED,
              }
            : null,
      };
    });
    // Coach-to-coach: @mentions and handover notes about the player.
    const noteItems = notes.map((note) => ({
      id: `note:${note.id}`,
      type: note.mentionIds.includes(coachId) ? 'NOTE_MENTION' : 'HANDOVER',
      title: note.body.slice(0, 300),
      xp: 0,
      meta: { handover: note.isHandover },
      createdAt: note.createdAt,
      player: note.player,
      actor: note.coach,
      unread: note.createdAt > seenAt,
      lesson: null,
    }));
    const merged = [...eventItems, ...noteItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return {
      unread: unreadEvents + unreadNotes,
      seenAt: coach?.feedSeenAt ?? null,
      hasMore: merged.length > limit,
      items: merged.slice(0, limit),
    };
  }

  /**
   * Open and recent missions of a player from all coaches, with who assigned
   * them ("assigned by"), for the coach side panel and chat links.
   */
  async playerWork(coachId: string, role: string, playerId: string) {
    this.requireCoach(role);
    if (
      role !== 'ADMIN' &&
      !(await coachCanSeePlayer(this.prisma, coachId, playerId))
    ) {
      throw new ForbiddenException('This player is not one of your players');
    }
    const since = new Date(Date.now() - 14 * 86_400_000);
    const rows = await this.prisma.lessonAssignment.findMany({
      where: {
        playerId,
        OR: [
          {
            status: {
              in: [
                AssignmentStatus.NEW,
                AssignmentStatus.OPEN,
                AssignmentStatus.IN_PROGRESS,
              ],
            },
          },
          { status: AssignmentStatus.COMPLETED, completedAt: { gte: since } },
        ],
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        status: true,
        dueDate: true,
        completedAt: true,
        stars: true,
        coachRating: true,
        coachId: true,
        lesson: {
          select: {
            name: true,
            focusArea: true,
            durationMinutes: true,
            coach: PERSON,
          },
        },
        block: { select: { plan: { select: { name: true } } } },
        team: { select: { shortName: true } },
      },
    });
    const coachIds = [...new Set(rows.map((row) => row.coachId))];
    const coaches = await this.prisma.user.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, firstName: true, lastName: true, profileImage: true },
    });
    const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      dueDate: row.dueDate,
      completedAt: row.completedAt,
      stars: row.stars,
      reviewed: row.coachRating != null,
      name: row.lesson.name,
      focusArea: row.lesson.focusArea,
      durationMinutes: row.lesson.durationMinutes,
      journey: row.block?.plan?.name ?? null,
      team: row.team?.shortName ?? null,
      assignedBy: coachById.get(row.coachId) ?? null,
      mine: row.coachId === coachId,
    }));
  }

  async feedSeen(coachId: string) {
    const now = new Date();
    await this.prisma.user.update({
      where: { id: coachId },
      data: { feedSeenAt: now },
    });
    return { seenAt: now };
  }

  // ── Player card for the coach ──────────────────────────────────────

  async playerCard(coachId: string, role: string, playerId: string) {
    this.requireCoach(role);
    if (
      role !== 'ADMIN' &&
      !(await coachCanSeePlayer(this.prisma, coachId, playerId))
    ) {
      throw new ForbiddenException('This player is not one of your players');
    }
    await this.game.sync(playerId);
    const timeZone = await this.game.timeZoneOf(playerId);
    const state = await this.game.computeState(playerId, timeZone);
    return {
      level: state.level,
      week: {
        goal: state.week.goal,
        days: state.week.thisWeekDays.length,
        weekStreak: state.week.weekStreak,
        bestWeekStreak: state.week.bestWeekStreak,
      },
      card: state.card,
      badges: state.badges
        .filter((badge) => badge.earned)
        .map((badge) => ({
          key: badge.key,
          title: badge.title,
          emoji: badge.emoji,
          earnedAt: badge.earnedAt,
        })),
    };
  }

  // ── Challenges ─────────────────────────────────────────────────────

  async listChallenges(coachId: string, role: string, teamId?: string) {
    this.requireCoach(role);
    if (teamId) await assertTeamAccess(this.prisma, coachId, role, teamId);
    const rows = await this.prisma.teamChallenge.findMany({
      where: {
        team: coachTeamsWhere(coachId),
        ...(teamId ? { teamId } : {}),
        endsAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
      },
      orderBy: [{ endsAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        focusArea: true,
        unit: true,
        higherIsBetter: true,
        targetScore: true,
        isBenchmark: true,
        startsAt: true,
        endsAt: true,
        coachId: true,
        coach: PERSON,
        team: {
          select: {
            id: true,
            shortName: true,
            icon: true,
            coachId: true,
            gameEnabled: true,
            _count: { select: { members: true } },
          },
        },
        entries: {
          select: {
            playerId: true,
            score: true,
            createdAt: true,
            player: PERSON,
          },
        },
      },
    });
    const now = new Date();
    return rows.map(({ entries, team, ...challenge }) => ({
      ...challenge,
      team: {
        id: team.id,
        shortName: team.shortName,
        icon: team.icon,
        gameEnabled: team.gameEnabled,
        members: team._count.members,
      },
      canEdit:
        challenge.coachId === coachId ||
        team.coachId === coachId ||
        role === 'ADMIN',
      status:
        challenge.startsAt > now
          ? 'upcoming'
          : challenge.endsAt < now
            ? 'ended'
            : 'active',
      leaderboard: bestEntries(entries, challenge.higherIsBetter).map(
        (entry, index) => ({
          rank: index + 1,
          player: entry.player,
          score: entry.score,
          attempts: entry.attempts,
        }),
      ),
    }));
  }

  private parseChallenge(body: Record<string, unknown>, partial: boolean) {
    const data: Prisma.TeamChallengeUncheckedUpdateInput = {};
    const text = (
      value: unknown,
      max: number,
      field: string,
      required: boolean,
    ) => {
      if (value === undefined) {
        if (required) throw new BadRequestException(`${field} is required`);
        return undefined;
      }
      if (value === null && !required) return null;
      if (typeof value !== 'string' || !value.trim()) {
        if (required) throw new BadRequestException(`${field} is required`);
        return null;
      }
      return value.trim().slice(0, max);
    };
    const title = text(body.title, 120, 'Title', !partial);
    if (title !== undefined && title !== null) data.title = title;
    const description = text(body.description, 1000, 'Description', false);
    if (description !== undefined) data.description = description;
    const unit = text(body.unit, 20, 'Unit', false);
    if (unit !== undefined) data.unit = unit || 'points';
    if (body.focusArea !== undefined) {
      if (body.focusArea === null || body.focusArea === '')
        data.focusArea = null;
      else if (
        FOCUS_AREAS.includes(body.focusArea as (typeof FOCUS_AREAS)[number])
      ) {
        data.focusArea =
          body.focusArea as Prisma.TeamChallengeUncheckedUpdateInput['focusArea'];
      } else throw new BadRequestException('Unknown focus area');
    }
    if (body.higherIsBetter !== undefined)
      data.higherIsBetter = body.higherIsBetter !== false;
    if (body.isBenchmark !== undefined)
      data.isBenchmark = body.isBenchmark === true;
    if (body.targetScore !== undefined) {
      if (body.targetScore === null || body.targetScore === '')
        data.targetScore = null;
      else {
        const value = Number(body.targetScore);
        if (!Number.isFinite(value) || value <= 0)
          throw new BadRequestException('Target must be positive');
        data.targetScore = Math.round(value);
      }
    }
    for (const field of ['startsAt', 'endsAt'] as const) {
      if (body[field] === undefined) {
        if (!partial) throw new BadRequestException(`${field} is required`);
        continue;
      }
      const raw = body[field];
      const date =
        typeof raw === 'string' || typeof raw === 'number'
          ? new Date(raw)
          : new Date(Number.NaN);
      if (Number.isNaN(date.getTime()))
        throw new BadRequestException(`${field} must be a date`);
      data[field] = date;
    }
    return data;
  }

  async createChallenge(
    coachId: string,
    role: string,
    body: Record<string, unknown>,
  ) {
    this.requireCoach(role);
    if (typeof body?.teamId !== 'string')
      throw new BadRequestException('teamId is required');
    const team = await assertTeamAccess(
      this.prisma,
      coachId,
      role,
      body.teamId,
    );
    const data = this.parseChallenge(body, false);
    if ((data.endsAt as Date) <= (data.startsAt as Date)) {
      throw new BadRequestException('The end must be after the start');
    }
    if (data.isBenchmark && !data.focusArea) {
      throw new BadRequestException('A benchmark test needs a focus area');
    }
    const created = await this.prisma.teamChallenge.create({
      data: {
        ...(data as Prisma.TeamChallengeUncheckedCreateInput),
        teamId: team.id,
        coachId,
      },
      select: { id: true, title: true, startsAt: true },
    });
    const members = await this.prisma.teamMember.findMany({
      where: { teamId: team.id, user: { role: 'PLAYER' } },
      select: { userId: true },
    });
    this.game.notify(
      members.map((member) => member.userId),
      'team',
      {
        title: `⚔️ New challenge: ${created.title}`,
        body: `${team.shortName} · post your score and climb the leaderboard`,
        url: '/player/team',
        tag: `challenge-${created.id}`,
      },
    );
    return created;
  }

  private async editableChallenge(coachId: string, role: string, id: string) {
    const challenge = await this.prisma.teamChallenge.findUnique({
      where: { id },
      select: {
        id: true,
        coachId: true,
        teamId: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const access = await assertTeamAccess(
      this.prisma,
      coachId,
      role,
      challenge.teamId,
    );
    if (!access.isHead && challenge.coachId !== coachId) {
      throw new ForbiddenException(
        'Only the creator or the head coach can change this challenge',
      );
    }
    return challenge;
  }

  async updateChallenge(
    coachId: string,
    role: string,
    id: string,
    body: Record<string, unknown>,
  ) {
    this.requireCoach(role);
    const challenge = await this.editableChallenge(coachId, role, id);
    const data = this.parseChallenge(body, true);
    const startsAt = (data.startsAt as Date | undefined) ?? challenge.startsAt;
    const endsAt = (data.endsAt as Date | undefined) ?? challenge.endsAt;
    if (endsAt <= startsAt)
      throw new BadRequestException('The end must be after the start');
    return this.prisma.teamChallenge.update({
      where: { id },
      data,
      select: { id: true, title: true },
    });
  }

  async deleteChallenge(coachId: string, role: string, id: string) {
    this.requireCoach(role);
    await this.editableChallenge(coachId, role, id);
    // Their XP stays in the ledger; the event just loses its challenge.
    await this.prisma.teamChallenge.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Team switch ────────────────────────────────────────────────────

  async setTeamGame(
    coachId: string,
    role: string,
    teamId: string,
    enabled: unknown,
  ) {
    this.requireCoach(role);
    await assertHeadCoach(this.prisma, coachId, role, teamId);
    if (typeof enabled !== 'boolean')
      throw new BadRequestException('enabled must be true or false');
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: { gameEnabled: enabled },
      select: { id: true, gameEnabled: true },
    });
    return team;
  }

  /** League of a team for coaches (this week, per member). */
  async teamLeague(coachId: string, role: string, teamId: string) {
    this.requireCoach(role);
    const access = await assertTeamAccess(this.prisma, coachId, role, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { gameEnabled: true },
    });
    const timeZone = await this.game.timeZoneOf(coachId);
    const week = weekOf(dayKey(new Date(), timeZone));
    const ranking = await this.game.leagueRanking(teamId, week, timeZone);
    const profiles = await this.prisma.playerProfile.findMany({
      where: { userId: { in: ranking.map((row) => row.playerId) } },
      select: { userId: true, xp: true, currentStreak: true },
    });
    const byId = new Map(profiles.map((profile) => [profile.userId, profile]));
    return {
      week,
      gameEnabled: team?.gameEnabled ?? true,
      isHead: access.isHead,
      ranking: ranking.map((row, index) => ({
        ...row,
        name: name(row),
        rank: index + 1,
        level: levelForXp(byId.get(row.playerId)?.xp ?? 0).level,
        weekStreak: byId.get(row.playerId)?.currentStreak ?? 0,
      })),
    };
  }
}
