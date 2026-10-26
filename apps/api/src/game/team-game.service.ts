import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey } from '../roster/roster.helpers';
import { GameService } from './game.service';
import { EVENT, weekOf } from './game-rules';

/** Event types teammates see in the team feed (no coach comments, no answers). */
export const TEAM_FEED_TYPES: string[] = [
  EVENT.LESSON_COMPLETED,
  EVENT.JOURNEY_COMPLETED,
  EVENT.BLOCK_COMPLETED,
  EVENT.BADGE_EARNED,
  EVENT.LEVEL_UP,
  EVENT.WEEK_GOAL,
  EVENT.CHALLENGE_ENTRY,
  EVENT.LEAGUE_PODIUM,
  EVENT.COACH_REVIEW,
];

const PERSON = {
  select: { id: true, firstName: true, lastName: true, profileImage: true },
} as const;
const FEED_DAYS = 14;

export function bestEntries<
  T extends { playerId: string; score: number; createdAt: Date },
>(entries: T[], higherIsBetter: boolean) {
  const best = new Map<string, T & { attempts: number }>();
  for (const entry of entries) {
    const current = best.get(entry.playerId);
    const better =
      !current ||
      (higherIsBetter
        ? entry.score > current.score
        : entry.score < current.score) ||
      (entry.score === current.score && entry.createdAt < current.createdAt);
    const attempts = (current?.attempts ?? 0) + 1;
    best.set(
      entry.playerId,
      better || !current ? { ...entry, attempts } : { ...current, attempts },
    );
  }
  return [...best.values()].sort((a, b) =>
    a.score === b.score
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : higherIsBetter
        ? b.score - a.score
        : a.score - b.score,
  );
}

/** Team side of the game for players: league, team feed, kudos, challenges. */
@Injectable()
export class TeamGameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GameService,
  ) {}

  private async gameTeams(playerId: string) {
    const rows = await this.prisma.teamMember.findMany({
      where: { userId: playerId, team: { gameEnabled: true } },
      select: { team: { select: { id: true, shortName: true, icon: true } } },
    });
    return rows.map((row) => row.team);
  }

  async team(playerId: string, requestedTimeZone?: string) {
    const timeZone = await this.game.timeZoneOf(playerId, requestedTimeZone);
    const week = weekOf(dayKey(new Date(), timeZone));
    const teams = await this.gameTeams(playerId);
    const leagues = await Promise.all(
      teams.map(async (team) => ({
        team,
        week,
        ranking: (await this.game.leagueRanking(team.id, week, timeZone)).map(
          (row, index) => ({
            ...row,
            rank: index + 1,
            me: row.playerId === playerId,
          }),
        ),
      })),
    );
    const [feed, challenges] = await Promise.all([
      this.feed(
        playerId,
        teams.map((team) => team.id),
      ),
      this.challenges(
        playerId,
        teams.map((team) => team.id),
      ),
    ]);
    return { week, leagues, feed, challenges };
  }

  private async feed(playerId: string, teamIds: string[]) {
    if (teamIds.length === 0) return [];
    const members = await this.prisma.teamMember.findMany({
      where: { teamId: { in: teamIds }, user: { role: 'PLAYER' } },
      select: { userId: true },
    });
    const ids = [...new Set(members.map((member) => member.userId))];
    const since = new Date(Date.now() - FEED_DAYS * 86_400_000);
    const events = await this.prisma.activityEvent.findMany({
      where: {
        playerId: { in: ids },
        type: { in: TEAM_FEED_TYPES },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        type: true,
        title: true,
        xp: true,
        meta: true,
        createdAt: true,
        player: PERSON,
        kudos: {
          select: { fromId: true, from: { select: { firstName: true } } },
        },
      },
    });
    return (
      events
        // Only "coach's pick" reviews are public; comments stay private.
        .filter(
          (event) =>
            event.type !== EVENT.COACH_REVIEW ||
            ((event.meta ?? {}) as { pick?: boolean }).pick === true,
        )
        .slice(0, 40)
        .map((event) => {
          const meta = (event.meta ?? {}) as Record<string, unknown>;
          return {
            id: event.id,
            type: event.type,
            title: event.title,
            xp: event.xp,
            createdAt: event.createdAt,
            player: event.player,
            mine: event.player.id === playerId,
            stars: typeof meta.stars === 'number' ? meta.stars : null,
            focusArea:
              typeof meta.focusArea === 'string' ? meta.focusArea : null,
            best: typeof meta.best === 'number' ? meta.best : null,
            unit: typeof meta.unit === 'string' ? meta.unit : null,
            kudos: event.kudos.length,
            kudosFrom: event.kudos
              .map((kudos) => kudos.from.firstName)
              .filter(Boolean)
              .slice(0, 5),
            gaveKudos: event.kudos.some((kudos) => kudos.fromId === playerId),
          };
        })
    );
  }

  /** Toggle kudos on a teammate's event. */
  async kudos(playerId: string, eventId: string) {
    const event = await this.prisma.activityEvent.findUnique({
      where: { id: eventId },
      select: { id: true, playerId: true, type: true, title: true },
    });
    if (!event || !TEAM_FEED_TYPES.includes(event.type)) {
      throw new NotFoundException('Activity not found');
    }
    if (event.playerId === playerId) {
      throw new BadRequestException('No kudos for yourself');
    }
    const shared = await this.prisma.teamMember.findFirst({
      where: {
        userId: playerId,
        team: {
          gameEnabled: true,
          members: { some: { userId: event.playerId } },
        },
      },
      select: { id: true },
    });
    if (!shared) throw new ForbiddenException('Not a teammate');
    const existing = await this.prisma.kudos.findUnique({
      where: { eventId_fromId: { eventId, fromId: playerId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.kudos.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.kudos.create({ data: { eventId, fromId: playerId } });
      const from = await this.prisma.user.findUnique({
        where: { id: playerId },
        select: { firstName: true },
      });
      this.game.notify([event.playerId], 'team', {
        title: `👏 ${from?.firstName ?? 'A teammate'} gave you kudos`,
        body: event.title ?? 'Well done!',
        url: '/player/team',
        tag: `kudos-${eventId}`,
      });
    }
    const count = await this.prisma.kudos.count({ where: { eventId } });
    return { eventId, kudos: count, gaveKudos: !existing };
  }

  private async challenges(playerId: string, teamIds: string[]) {
    if (teamIds.length === 0) return [];
    const now = new Date();
    const rows = await this.prisma.teamChallenge.findMany({
      where: {
        teamId: { in: teamIds },
        startsAt: { lte: new Date(now.getTime() + 14 * 86_400_000) },
        endsAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
      },
      orderBy: { endsAt: 'asc' },
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
        team: { select: { id: true, shortName: true, icon: true } },
        coach: PERSON,
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
    return rows.map(({ entries, ...challenge }) => {
      const board = bestEntries(entries, challenge.higherIsBetter).map(
        (entry, index) => ({
          rank: index + 1,
          player: entry.player,
          score: entry.score,
          attempts: entry.attempts,
          me: entry.playerId === playerId,
        }),
      );
      return {
        ...challenge,
        status:
          challenge.startsAt > now
            ? 'upcoming'
            : challenge.endsAt < now
              ? 'ended'
              : 'active',
        leaderboard: board.slice(0, 20),
        mine: board.find((row) => row.me) ?? null,
        participants: board.length,
      };
    });
  }

  async enterChallenge(
    playerId: string,
    challengeId: string,
    body: { score?: unknown; note?: unknown },
  ) {
    const challenge = await this.prisma.teamChallenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        teamId: true,
        startsAt: true,
        endsAt: true,
        title: true,
        team: { select: { gameEnabled: true } },
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const member = await this.prisma.teamMember.findFirst({
      where: { teamId: challenge.teamId, userId: playerId },
      select: { id: true },
    });
    if (!member || !challenge.team.gameEnabled)
      throw new ForbiddenException('Not your challenge');
    const now = new Date();
    if (challenge.startsAt > now)
      throw new BadRequestException('This challenge has not started yet');
    if (challenge.endsAt < now)
      throw new BadRequestException('This challenge is over');
    const score =
      typeof body?.score === 'number' ? body.score : Number(body?.score);
    if (!Number.isFinite(score) || score < 0 || score > 100000) {
      throw new BadRequestException('Score must be a number');
    }
    const note =
      typeof body?.note === 'string'
        ? body.note.trim().slice(0, 300) || null
        : null;
    const recent = await this.prisma.challengeEntry.count({
      where: {
        challengeId,
        playerId,
        createdAt: { gte: new Date(now.getTime() - 86_400_000) },
      },
    });
    if (recent >= 10) throw new BadRequestException('At most 10 tries per day');
    await this.prisma.challengeEntry.create({
      data: { challengeId, playerId, score: Math.round(score), note },
    });
    const outcome = await this.game.sync(playerId);
    const { state, ...rest } = outcome;
    void state;
    return { outcome: rest };
  }
}
