import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentTargetType,
  OwnerType,
  Prisma,
} from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { syncJourneyAssignmentLifecycleForPlanIds } from '../assignments/assignment-lifecycle';
import { GameService } from './game.service';
import { missionStars, splitExercises } from './game-rules';

const DONE: AssignmentStatus[] = [
  AssignmentStatus.COMPLETED,
  AssignmentStatus.ARCHIVED,
];
const MAX_NOTES = 2000;

const PERSON = {
  select: { id: true, firstName: true, lastName: true, profileImage: true },
} as const;

const MISSION_SELECT = {
  id: true,
  status: true,
  targetType: true,
  playerId: true,
  teamId: true,
  blockId: true,
  sortOrder: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  isInTrainingQueue: true,
  selfAssessment: true,
  playerNotes: true,
  stars: true,
  resultScore: true,
  practiceMinutes: true,
  exercisesDone: true,
  coachId: true,
  coachRating: true,
  coachComment: true,
  coachPick: true,
  reviewedAt: true,
  playerSeenReviewAt: true,
  reviewedBy: PERSON,
  team: { select: { id: true, shortName: true, icon: true } },
  calendarTask: { select: { id: true, scheduledDate: true } },
  lesson: {
    select: {
      id: true,
      name: true,
      description: true,
      focusArea: true,
      subCapability: true,
      durationMinutes: true,
      location: true,
      videoUrl: true,
      trainingObjective: true,
      successCriteria: true,
      plannedExercises: true,
      targetScore: true,
      targetAttempts: true,
      coach: PERSON,
    },
  },
} satisfies Prisma.LessonAssignmentSelect;

type MissionRow = Prisma.LessonAssignmentGetPayload<{
  select: typeof MISSION_SELECT;
}>;

export function lifecycle(status: string) {
  if (status === 'COMPLETED' || status === 'ARCHIVED') return 'COMPLETED';
  if (status === 'IN_PROGRESS') return 'ACTIVE';
  if (status === 'OPEN') return 'ACCEPTED';
  return 'PENDING';
}

function toMission(row: MissionRow, locked = false) {
  return {
    id: row.id,
    status: lifecycle(row.status),
    locked,
    isTeam: row.targetType === AssignmentTargetType.TEAM,
    team: row.team,
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    inQueue: row.isInTrainingQueue,
    scheduledAt: row.calendarTask?.scheduledDate ?? null,
    selfAssessment: row.selfAssessment,
    playerNotes: row.playerNotes,
    stars: row.stars,
    resultScore: row.resultScore,
    practiceMinutes: row.practiceMinutes,
    exercisesDone: row.exercisesDone,
    lesson: {
      ...row.lesson,
      exercises: splitExercises(row.lesson.plannedExercises),
    },
    coach: row.lesson.coach,
    review:
      row.coachRating != null
        ? {
            rating: row.coachRating,
            comment: row.coachComment,
            pick: row.coachPick,
            at: row.reviewedAt,
            by: row.reviewedBy,
            seen: Boolean(row.playerSeenReviewAt),
          }
        : null,
  };
}

export type Mission = ReturnType<typeof toMission>;

/** Missions = lesson assignments seen as a game: path, inbox, start, complete. */
@Injectable()
export class MissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GameService,
  ) {}

  private async teamIds(playerId: string) {
    const rows = await this.prisma.teamMember.findMany({
      where: { userId: playerId },
      select: { teamId: true },
    });
    return rows.map((row) => row.teamId);
  }

  private async ownAssignment(playerId: string, assignmentId: string) {
    const row = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: { ...MISSION_SELECT, block: { select: { planId: true } } },
    });
    if (!row) throw new NotFoundException('Mission not found');
    const own =
      (row.targetType === AssignmentTargetType.PLAYER &&
        row.playerId === playerId) ||
      (row.targetType === AssignmentTargetType.TEAM &&
        row.teamId &&
        (await this.prisma.teamMember.findFirst({
          where: { teamId: row.teamId, userId: playerId },
          select: { id: true },
        })));
    if (!own) throw new ForbiddenException('Not your mission');
    return row;
  }

  /** Inbox (new), journeys as paths, side missions and the next mission. */
  async path(playerId: string) {
    const teamIds = await this.teamIds(playerId);
    const assignmentWhere: Prisma.LessonAssignmentWhereInput = {
      OR: [
        { targetType: AssignmentTargetType.PLAYER, playerId },
        ...(teamIds.length
          ? [{ targetType: AssignmentTargetType.TEAM, teamId: { in: teamIds } }]
          : []),
      ],
    };
    const [journeyAssignments, plans, side] = await Promise.all([
      this.prisma.journeyTemplateAssignment.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          playerPlanId: true,
          createdAt: true,
          coach: PERSON,
          team: { select: { id: true, shortName: true, icon: true } },
          journeyTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              difficulty: true,
              _count: { select: { lessons: true } },
            },
          },
        },
      }),
      this.prisma.playerDevelopmentPlan.findMany({
        where: {
          OR: [
            { ownerType: OwnerType.PLAYER, playerId },
            ...(teamIds.length
              ? [{ ownerType: OwnerType.TEAM, teamId: { in: teamIds } }]
              : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          coach: PERSON,
          team: { select: { id: true, shortName: true, icon: true } },
          blocks: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              goal: true,
              assignments: {
                where: assignmentWhere,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: MISSION_SELECT,
              },
            },
          },
        },
      }),
      this.prisma.lessonAssignment.findMany({
        where: { ...assignmentWhere, blockId: null },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: MISSION_SELECT,
      }),
    ]);

    const pendingPlanIds = new Set(
      journeyAssignments
        .filter((j) => j.status === AssignmentStatus.NEW)
        .map((j) => j.playerPlanId),
    );
    const journeyByPlan = new Map(
      journeyAssignments.map((j) => [j.playerPlanId, j]),
    );

    const journeys = plans
      .filter((plan) => !pendingPlanIds.has(plan.id))
      .map((plan) => {
        const blocks = plan.blocks.map((block) => ({
          id: block.id,
          name: block.name,
          goal: block.goal,
          missions: block.assignments.map((row, index) => {
            const previous = block.assignments[index - 1];
            const locked =
              index > 0 &&
              !DONE.includes(previous.status) &&
              (row.status === AssignmentStatus.NEW ||
                row.status === AssignmentStatus.OPEN);
            const mission = toMission(row, locked);
            // In an accepted journey every step is ready to play.
            return mission.status === 'PENDING'
              ? { ...mission, status: 'ACCEPTED' }
              : mission;
          }),
        }));
        const all = blocks.flatMap((block) => block.missions);
        const journey = journeyByPlan.get(plan.id);
        return {
          planId: plan.id,
          journeyAssignmentId: journey?.id ?? null,
          name: plan.name,
          description: plan.description,
          coach: plan.coach,
          team: plan.team ?? journey?.team ?? null,
          total: all.length,
          done: all.filter((mission) => mission.status === 'COMPLETED').length,
          blocks,
        };
      })
      .filter((journey) => journey.total > 0);

    const sideMissions = side.map((row) => toMission(row));
    const inbox = {
      journeys: journeyAssignments
        .filter((j) => j.status === AssignmentStatus.NEW)
        .map((j) => ({
          id: j.id,
          name: j.journeyTemplate.name,
          description: j.journeyTemplate.description,
          lessonCount: j.journeyTemplate._count.lessons,
          coach: j.coach,
          team: j.team,
          createdAt: j.createdAt,
        })),
      missions: sideMissions.filter((mission) => mission.status === 'PENDING'),
    };

    // Next mission: started first, then accepted journey steps, then side
    // missions by due date.
    const open = [
      ...journeys.flatMap((journey) =>
        journey.blocks.flatMap((block) =>
          block.missions.map((mission) => ({ mission, journey: journey.name })),
        ),
      ),
      ...sideMissions.map((mission) => ({
        mission,
        journey: null as string | null,
      })),
    ].filter(
      ({ mission }) =>
        !mission.locked &&
        mission.status !== 'COMPLETED' &&
        mission.status !== 'PENDING',
    );
    const rank = (m: Mission) =>
      (m.status === 'ACTIVE' ? 0 : 1e13) +
      (m.dueDate ? new Date(m.dueDate).getTime() : 9e12);
    open.sort((a, b) => rank(a.mission) - rank(b.mission));

    return {
      inbox,
      journeys,
      side: sideMissions.filter((mission) => mission.status !== 'PENDING'),
      next: open[0]
        ? { ...open[0].mission, journeyName: open[0].journey }
        : null,
      upNext: open
        .slice(0, 6)
        .map(({ mission, journey }) => ({ ...mission, journeyName: journey })),
    };
  }

  async mission(playerId: string, assignmentId: string) {
    const row = await this.ownAssignment(playerId, assignmentId);
    if (!row.blockId) return toMission(row);
    // Journey step: locked until the step before is done; ready once the
    // journey is accepted.
    const [siblings, journey] = await Promise.all([
      this.prisma.lessonAssignment.findMany({
        where: { blockId: row.blockId, playerId: row.playerId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, status: true },
      }),
      row.block?.planId
        ? this.prisma.journeyTemplateAssignment.findFirst({
            where: { playerPlanId: row.block.planId, playerId },
            select: {
              status: true,
              journeyTemplate: { select: { name: true } },
            },
          })
        : null,
    ]);
    const index = siblings.findIndex((sibling) => sibling.id === row.id);
    const previous = index > 0 ? siblings[index - 1] : null;
    const locked =
      Boolean(previous && !DONE.includes(previous.status)) &&
      (row.status === AssignmentStatus.NEW ||
        row.status === AssignmentStatus.OPEN);
    const mission = toMission(row, locked);
    const accepted = !journey || journey.status !== AssignmentStatus.NEW;
    return {
      ...mission,
      status:
        mission.status === 'PENDING' && accepted ? 'ACCEPTED' : mission.status,
      journeyName: journey?.journeyTemplate.name ?? null,
    };
  }

  /** Accept new journeys and missions (all, or the given ids). */
  async accept(
    playerId: string,
    body: { journeyIds?: unknown; missionIds?: unknown; all?: unknown },
  ) {
    const ids = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((id): id is string => typeof id === 'string')
            .slice(0, 200)
        : [];
    const all = body?.all === true;
    const journeyIds = ids(body?.journeyIds);
    const missionIds = ids(body?.missionIds);

    const journeys = await this.prisma.journeyTemplateAssignment.findMany({
      where: {
        playerId,
        status: AssignmentStatus.NEW,
        ...(all ? {} : { id: { in: journeyIds } }),
      },
      select: { id: true, playerPlanId: true },
    });
    if (journeys.length) {
      await this.prisma.journeyTemplateAssignment.updateMany({
        where: { id: { in: journeys.map((j) => j.id) } },
        data: { status: AssignmentStatus.OPEN, isInTrainingQueue: false },
      });
      await syncJourneyAssignmentLifecycleForPlanIds(
        this.prisma,
        journeys.map((j) => j.playerPlanId),
      );
    }
    const missions = await this.prisma.lessonAssignment.updateMany({
      where: {
        targetType: AssignmentTargetType.PLAYER,
        playerId,
        blockId: null,
        status: AssignmentStatus.NEW,
        ...(all ? {} : { id: { in: missionIds } }),
      },
      data: { status: AssignmentStatus.OPEN, isInTrainingQueue: true },
    });
    const outcome = await this.game.sync(playerId);
    return {
      journeys: journeys.length,
      missions: missions.count,
      outcome: strip(outcome),
    };
  }

  private async assertUnlocked(playerId: string, assignmentId: string) {
    const mission = await this.mission(playerId, assignmentId);
    if (mission.locked)
      throw new BadRequestException('Finish the step before first');
  }

  async start(playerId: string, assignmentId: string) {
    await this.assertUnlocked(playerId, assignmentId);
    const row = await this.ownAssignment(playerId, assignmentId);
    if (DONE.includes(row.status)) return toMission(row);
    const updated = await this.prisma.lessonAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.IN_PROGRESS, isInTrainingQueue: true },
      select: MISSION_SELECT,
    });
    if (row.block?.planId) {
      await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, [
        row.block.planId,
      ]);
    }
    return toMission(updated);
  }

  async complete(
    playerId: string,
    assignmentId: string,
    body: {
      resultScore?: unknown;
      practiceMinutes?: unknown;
      exercisesDone?: unknown;
      selfAssessment?: unknown;
      playerNotes?: unknown;
    },
  ) {
    await this.assertUnlocked(playerId, assignmentId);
    const row = await this.ownAssignment(playerId, assignmentId);
    const int = (value: unknown, min: number, max: number, field: string) => {
      if (value === undefined || value === null || value === '') return null;
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(number) || number < min || number > max) {
        throw new BadRequestException(
          `${field} must be between ${min} and ${max}`,
        );
      }
      return Math.round(number);
    };
    const exercises = splitExercises(row.lesson.plannedExercises);
    const resultScore = int(body?.resultScore, 0, 1000, 'Result');
    const practiceMinutes = int(body?.practiceMinutes, 0, 600, 'Minutes');
    const selfAssessment = int(body?.selfAssessment, 1, 10, 'Self-assessment');
    const exercisesDone = Array.isArray(body?.exercisesDone)
      ? [
          ...new Set(
            body.exercisesDone.filter(
              (i): i is number =>
                Number.isInteger(i) && i >= 0 && i < exercises.length,
            ),
          ),
        ]
      : row.exercisesDone;
    let playerNotes: string | null | undefined = undefined;
    if (body?.playerNotes !== undefined) {
      if (body.playerNotes !== null && typeof body.playerNotes !== 'string') {
        throw new BadRequestException('Notes must be text');
      }
      playerNotes = (body.playerNotes ?? '').trim().slice(0, MAX_NOTES) || null;
    }
    const stars = missionStars({
      resultScore,
      targetScore: row.lesson.targetScore,
      exerciseCount: exercises.length,
      exercisesDone: exercisesDone.length,
      practiceMinutes,
      durationMinutes: row.lesson.durationMinutes,
    });
    const alreadyDone = DONE.includes(row.status);
    // Keep the better result when the player replays a mission.
    const keepStars = alreadyDone && (row.stars ?? 0) > stars;

    const updated = await this.prisma.lessonAssignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.COMPLETED,
        completedAt: row.completedAt ?? new Date(),
        coachReviewedAt: null,
        resultScore: keepStars ? row.resultScore : resultScore,
        practiceMinutes: practiceMinutes ?? row.practiceMinutes,
        exercisesDone,
        stars: keepStars ? row.stars : stars,
        ...(selfAssessment !== null ? { selfAssessment } : {}),
        ...(playerNotes !== undefined ? { playerNotes } : {}),
      },
      select: MISSION_SELECT,
    });
    if (row.block?.planId) {
      await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, [
        row.block.planId,
      ]);
    }
    const outcome = await this.game.sync(playerId);

    // Next mission in the same block that just got unlocked.
    let unlocked: { id: string; name: string } | null = null;
    if (row.blockId) {
      const next = await this.prisma.lessonAssignment.findFirst({
        where: {
          blockId: row.blockId,
          playerId,
          status: { in: [AssignmentStatus.NEW, AssignmentStatus.OPEN] },
          OR: [
            { sortOrder: { gt: row.sortOrder } },
            { sortOrder: row.sortOrder, createdAt: { gt: row.createdAt } },
          ],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, lesson: { select: { name: true } } },
      });
      if (next) unlocked = { id: next.id, name: next.lesson.name };
    }
    return {
      mission: toMission(updated),
      stars: updated.stars ?? stars,
      unlocked,
      outcome: strip(outcome),
    };
  }

  /** The player opened their reviews. */
  async markReviewsSeen(playerId: string, assignmentId?: unknown) {
    const result = await this.prisma.lessonAssignment.updateMany({
      where: {
        playerId,
        coachRating: { not: null },
        playerSeenReviewAt: null,
        ...(typeof assignmentId === 'string' ? { id: assignmentId } : {}),
      },
      data: { playerSeenReviewAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Reviews for the home card (newest first). */
  async reviews(playerId: string) {
    const rows = await this.prisma.lessonAssignment.findMany({
      where: { playerId, coachRating: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      take: 20,
      select: MISSION_SELECT,
    });
    return rows.map((row) => toMission(row));
  }
}

/** The outcome without the (large) state. */
function strip<T extends { state?: unknown }>(outcome: T) {
  const { state, ...rest } = outcome;
  void state;
  return rest;
}
