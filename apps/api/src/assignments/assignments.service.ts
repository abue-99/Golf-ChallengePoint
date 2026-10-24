import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentStatus,
  AssignmentSourceType,
  AssignmentTargetType,
  LessonPriority,
  OwnerType,
  Prisma,
} from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertCoachCanSeePlayer,
  assertTeamAccess,
} from '../teams/team-access';
import {
  syncJourneyAssignmentLifecycleForPlanIds,
  toStoredAssignmentStatus,
} from './assignment-lifecycle';

type CreateAssignmentInput = {
  lessonId: string;
  targetType?: string;
  sourceType?: string;
  sourceReference?: string;
  playerId?: string;
  teamId?: string;
  groupName?: string;
  blockId?: string;
  teamEventId?: string;
  dueDate?: string;
  priority?: string;
  sortOrder?: number;
  isInTrainingQueue?: boolean;
  schedule?: {
    practiceSlotId: string;
    title?: string;
    description?: string;
    scheduledDate: string;
    durationMinutes?: number;
  };
};

type UpdateAssignmentInput = {
  status?: string;
  dueDate?: string | null;
  priority?: string;
  sortOrder?: number;
  playerNotes?: string;
  selfAssessment?: number | null;
  isInTrainingQueue?: boolean;
};

const journeyAssignmentInclude = {
  journeyTemplate: {
    select: {
      id: true,
      name: true,
      category: true,
      difficulty: true,
      coverImageUrl: true,
    },
  },
  team: { select: { id: true, shortName: true, icon: true } },
  player: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.JourneyTemplateAssignmentInclude;

type JourneyAssignmentListItem = Prisma.JourneyTemplateAssignmentGetPayload<{
  include: typeof journeyAssignmentInclude;
}>;

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCoachOrAdmin(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only coaches and admins can manage assignments',
      );
    }
  }

  /** Linked player or member of one of the coach's teams. */
  private async assertCoachPlayerLink(coachId: string, playerId: string) {
    await assertCoachCanSeePlayer(this.prisma, coachId, playerId);
  }

  /** Head coach or coaching staff of the team. */
  private async assertCoachOwnsTeam(coachId: string, teamId: string) {
    return assertTeamAccess(this.prisma, coachId, 'COACH', teamId);
  }

  private async getActiveTeamIdsForPlayer(playerId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: playerId },
      select: { teamId: true },
    });
    return memberships.map((membership) => membership.teamId);
  }

  private async resolvePlayerAccess(
    assignment: {
      targetType: AssignmentTargetType;
      playerId: string | null;
      teamId: string | null;
    },
    userId: string,
  ) {
    if (
      assignment.targetType === AssignmentTargetType.PLAYER &&
      assignment.playerId === userId
    ) {
      return true;
    }

    if (
      assignment.targetType === AssignmentTargetType.TEAM &&
      assignment.teamId
    ) {
      const membership = await this.prisma.teamMember.findFirst({
        where: { teamId: assignment.teamId, userId },
        select: { id: true },
      });
      return Boolean(membership);
    }

    return false;
  }

  private assignmentInclude() {
    return {
      lesson: {
        select: {
          id: true,
          name: true,
          focusArea: true,
          durationMinutes: true,
          trainingObjective: true,
          successCriteria: true,
          plannedExercises: true,
          subCapability: true,
          subSubCapability: true,
        },
      },
      player: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      team: { select: { id: true, shortName: true, icon: true } },
      teamEvent: {
        select: { id: true, title: true, startTime: true, endTime: true },
      },
      calendarTask: {
        select: {
          id: true,
          title: true,
          description: true,
          scheduledDate: true,
          durationMinutes: true,
          status: true,
        },
      },
      block: {
        select: {
          id: true,
          planId: true,
          plan: {
            select: {
              id: true,
              name: true,
              ownerType: true,
              teamId: true,
              team: { select: { id: true, shortName: true, icon: true } },
            },
          },
        },
      },
    } satisfies Prisma.LessonAssignmentInclude;
  }

  private toQueueLessonItem<T extends { status: AssignmentStatus }>(
    assignment: T,
  ) {
    return {
      ...assignment,
      itemType: 'lesson' as const,
      isNew: assignment.status === AssignmentStatus.NEW,
      source: 'assignedByCoach',
    };
  }

  async createAssignment(
    coachId: string,
    role: string,
    data: CreateAssignmentInput,
  ) {
    this.requireCoachOrAdmin(role);

    const lesson = await this.prisma.trainingLesson.findUnique({
      where: { id: data.lessonId },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        trainingObjective: true,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const targetType =
      (data.targetType as AssignmentTargetType | undefined) ??
      (data.playerId
        ? AssignmentTargetType.PLAYER
        : data.teamId
          ? AssignmentTargetType.TEAM
          : AssignmentTargetType.GROUP);

    let playerId: string | null = null;
    let teamId: string | null = null;
    let groupName: string | null = null;
    let sourceType: AssignmentSourceType =
      (data.sourceType as AssignmentSourceType | undefined) ??
      AssignmentSourceType.PLAYER;
    let sourceReference: string | null = data.sourceReference ?? null;

    if (targetType === AssignmentTargetType.PLAYER) {
      if (!data.playerId) {
        throw new BadRequestException(
          'playerId is required for player assignments',
        );
      }
      playerId = data.playerId;
      if (role !== 'ADMIN') await this.assertCoachPlayerLink(coachId, playerId);
      sourceType = sourceType ?? AssignmentSourceType.PLAYER;
      sourceReference = sourceReference ?? playerId;
    } else if (targetType === AssignmentTargetType.TEAM) {
      if (!data.teamId) {
        throw new BadRequestException(
          'teamId is required for team assignments',
        );
      }
      teamId = data.teamId;
      if (role !== 'ADMIN') await this.assertCoachOwnsTeam(coachId, teamId);
      sourceType = AssignmentSourceType.TEAM;
      sourceReference = teamId;
    } else {
      groupName = data.groupName?.trim() || null;
      if (!groupName) {
        throw new BadRequestException(
          'groupName is required for group assignments',
        );
      }
      sourceType = AssignmentSourceType.GROUP;
      sourceReference = groupName;
    }

    if (data.blockId) {
      const block = await this.prisma.trainingBlock.findUnique({
        where: { id: data.blockId },
        select: { id: true, coachId: true },
      });
      if (!block) throw new NotFoundException('Training block not found');
      if (role !== 'ADMIN' && block.coachId !== coachId) {
        throw new ForbiddenException('Not your training block');
      }
    }

    if (data.teamEventId) {
      const teamEvent = await this.prisma.teamEvent.findUnique({
        where: { id: data.teamEventId },
        select: { id: true, teamId: true },
      });
      if (!teamEvent) throw new NotFoundException('Team event not found');
      if (role !== 'ADMIN') {
        await this.assertCoachOwnsTeam(coachId, teamEvent.teamId);
      }
      if (
        targetType === AssignmentTargetType.TEAM &&
        teamId &&
        teamEvent.teamId !== teamId
      ) {
        throw new BadRequestException(
          'Assignment team must match team event team',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (targetType === AssignmentTargetType.TEAM && teamId) {
        const members = await tx.teamMember.findMany({
          where: { teamId, user: { role: 'PLAYER' } },
          select: { userId: true },
        });
        const uniquePlayerIds = [...new Set(members.map((m) => m.userId))];
        if (uniquePlayerIds.length === 0) {
          return {
            teamId,
            lessonId: data.lessonId,
            playersAffected: 0,
            assignmentsCreated: 0,
            assignments: [],
          };
        }

        const created = await Promise.all(
          uniquePlayerIds.map((memberPlayerId) =>
            tx.lessonAssignment.create({
              data: {
                lessonId: data.lessonId,
                targetType: AssignmentTargetType.PLAYER,
                sourceType: AssignmentSourceType.TEAM,
                sourceReference: teamId,
                playerId: memberPlayerId,
                teamId,
                groupName: null,
                blockId: data.blockId ?? null,
                teamEventId: data.teamEventId ?? null,
                coachId,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                priority: (data.priority ??
                  LessonPriority.MEDIUM) as LessonPriority,
                sortOrder: data.sortOrder ?? 0,
                isInTrainingQueue: false,
                status: AssignmentStatus.NEW,
              },
              include: this.assignmentInclude(),
            }),
          ),
        );

        return {
          teamId,
          lessonId: data.lessonId,
          playersAffected: uniquePlayerIds.length,
          assignmentsCreated: created.length,
          assignments: created,
        };
      }

      const assignment = await tx.lessonAssignment.create({
        data: {
          lessonId: data.lessonId,
          targetType,
          sourceType,
          sourceReference,
          playerId,
          teamId,
          groupName,
          blockId: data.blockId ?? null,
          teamEventId: data.teamEventId ?? null,
          coachId,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          priority: (data.priority ?? LessonPriority.MEDIUM) as LessonPriority,
          sortOrder: data.sortOrder ?? 0,
          isInTrainingQueue: Boolean(data.isInTrainingQueue),
          status: AssignmentStatus.NEW,
        },
      });

      if (data.schedule) {
        const slot = await tx.practiceSlot.findUnique({
          where: { id: data.schedule.practiceSlotId },
          select: { id: true, ownerType: true, playerId: true, teamId: true },
        });
        if (!slot) throw new NotFoundException('Practice slot not found');
        if (slot.ownerType === OwnerType.PLAYER && slot.playerId) {
          if (role !== 'ADMIN')
            await this.assertCoachPlayerLink(coachId, slot.playerId);
          if (playerId && slot.playerId !== playerId) {
            throw new BadRequestException(
              'Schedule slot player must match assignment player',
            );
          }
        }
        if (slot.ownerType === OwnerType.TEAM && slot.teamId) {
          if (role !== 'ADMIN')
            await this.assertCoachOwnsTeam(coachId, slot.teamId);
          if (teamId && slot.teamId !== teamId) {
            throw new BadRequestException(
              'Schedule slot team must match assignment team',
            );
          }
        }

        const scheduledDate = new Date(data.schedule.scheduledDate);
        if (Number.isNaN(scheduledDate.getTime())) {
          throw new BadRequestException('Invalid scheduledDate value');
        }

        await tx.calendarTask.create({
          data: {
            practiceSlotId: slot.id,
            coachId,
            title: data.schedule.title?.trim() || lesson.name,
            description:
              data.schedule.description?.trim() ||
              lesson.trainingObjective ||
              lesson.name,
            durationMinutes:
              data.schedule.durationMinutes ?? lesson.durationMinutes,
            scheduledDate,
            lessonId: lesson.id,
            assignmentId: assignment.id,
          },
        });

        return tx.lessonAssignment.update({
          where: { id: assignment.id },
          data: {
            status: AssignmentStatus.OPEN,
            dueDate: scheduledDate,
            isInTrainingQueue: true,
          },
          include: this.assignmentInclude(),
        });
      }

      return tx.lessonAssignment.findUnique({
        where: { id: assignment.id },
        include: this.assignmentInclude(),
      });
    });
  }

  async assignLessonToPlayer(
    coachId: string,
    role: string,
    playerId: string,
    data: { lessonId: string; dueDate?: string; priority?: string },
  ) {
    return this.createAssignment(coachId, role, {
      lessonId: data.lessonId,
      targetType: AssignmentTargetType.PLAYER,
      playerId,
      dueDate: data.dueDate,
      priority: data.priority,
      isInTrainingQueue: false,
      sourceType: AssignmentSourceType.PLAYER,
      sourceReference: playerId,
    });
  }

  async assignLessonToTeam(
    coachId: string,
    role: string,
    teamId: string,
    data: { lessonId: string; dueDate?: string; priority?: string },
  ) {
    return this.createAssignment(coachId, role, {
      lessonId: data.lessonId,
      targetType: AssignmentTargetType.TEAM,
      teamId,
      dueDate: data.dueDate,
      priority: data.priority,
      isInTrainingQueue: false,
      sourceType: AssignmentSourceType.TEAM,
      sourceReference: teamId,
    });
  }

  async listMyAssignments(
    userId: string,
    role: string,
    filters: { status?: string; queueOnly?: string },
  ) {
    if (role === 'PLAYER') {
      let playerJourneyAssignments: JourneyAssignmentListItem[] = [];

      if (filters.queueOnly !== 'true') {
        playerJourneyAssignments =
          await this.prisma.journeyTemplateAssignment.findMany({
            where: {
              playerId: userId,
              ...(filters.status
                ? { status: toStoredAssignmentStatus(filters.status) }
                : {}),
            },
            include: journeyAssignmentInclude,
            orderBy: { createdAt: 'desc' },
          });

        const validPlanIdSet = new Set(
          (
            await this.prisma.playerDevelopmentPlan.findMany({
              where: {
                id: {
                  in: playerJourneyAssignments.map(
                    (assignment) => assignment.playerPlanId,
                  ),
                },
              },
              select: { id: true },
            })
          ).map((plan) => plan.id),
        );

        const invalidJourneyIds = playerJourneyAssignments
          .filter((assignment) => !validPlanIdSet.has(assignment.playerPlanId))
          .map((assignment) => assignment.id);
        if (invalidJourneyIds.length > 0) {
          await this.prisma.journeyTemplateAssignment.deleteMany({
            where: { id: { in: invalidJourneyIds } },
          });
        }

        const queuedJourneyIds = playerJourneyAssignments
          .filter(
            (assignment) =>
              validPlanIdSet.has(assignment.playerPlanId) &&
              assignment.isInTrainingQueue,
          )
          .map((assignment) => assignment.id);
        if (queuedJourneyIds.length > 0) {
          await this.prisma.journeyTemplateAssignment.updateMany({
            where: { id: { in: queuedJourneyIds } },
            data: { isInTrainingQueue: false },
          });
        }

        const validPlanIds = playerJourneyAssignments
          .map((assignment) => assignment.playerPlanId)
          .filter((planId) => validPlanIdSet.has(planId));
        await syncJourneyAssignmentLifecycleForPlanIds(
          this.prisma,
          validPlanIds,
        );

        playerJourneyAssignments =
          await this.prisma.journeyTemplateAssignment.findMany({
            where: {
              playerId: userId,
              playerPlanId: { in: validPlanIds },
              ...(filters.status
                ? { status: toStoredAssignmentStatus(filters.status) }
                : {}),
            },
            include: journeyAssignmentInclude,
            orderBy: { createdAt: 'desc' },
          });
      }

      const [lessonAssignments, journeyAssignments] = await Promise.all([
        this.prisma.lessonAssignment.findMany({
          where: {
            targetType: AssignmentTargetType.PLAYER,
            playerId: userId,
            ...(filters.status
              ? { status: toStoredAssignmentStatus(filters.status) }
              : {}),
            ...(filters.queueOnly === 'true'
              ? { isInTrainingQueue: true }
              : {}),
          },
          include: this.assignmentInclude(),
          orderBy: { createdAt: 'desc' },
        }),
        Promise.resolve(playerJourneyAssignments),
      ]);

      const journeyByPlanId = new Map(
        journeyAssignments.map((assignment) => [
          assignment.playerPlanId,
          assignment.journeyTemplate,
        ]),
      );

      const lessonItems = lessonAssignments.map((assignment) => ({
        ...this.toQueueLessonItem(assignment),
        journeyTemplate: assignment.block?.planId
          ? (journeyByPlanId.get(assignment.block.planId) ?? null)
          : null,
        playerPlanId: assignment.block?.planId ?? null,
      }));
      const journeyItems = journeyAssignments.map((assignment) => ({
        id: assignment.id,
        lessonId: null,
        targetType: AssignmentTargetType.PLAYER,
        sourceType: assignment.teamId
          ? AssignmentSourceType.TEAM
          : AssignmentSourceType.PLAYER,
        sourceReference: assignment.teamId ?? assignment.playerId,
        playerId: assignment.playerId,
        teamId: assignment.teamId,
        groupName: null,
        coachId: assignment.coachId,
        status: assignment.status,
        priority: LessonPriority.MEDIUM,
        isInTrainingQueue: assignment.isInTrainingQueue,
        dueDate: null,
        playerNotes: null,
        sortOrder: 0,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        lesson: null,
        player: null,
        team: assignment.team,
        teamEvent: null,
        calendarTask: null,
        itemType: 'journey' as const,
        isNew: assignment.status === AssignmentStatus.NEW,
        source: assignment.source,
        journeyTemplate: assignment.journeyTemplate,
        playerPlanId: assignment.playerPlanId,
      }));

      return [...lessonItems, ...journeyItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    this.requireCoachOrAdmin(role);
    let journeyAssignments: JourneyAssignmentListItem[] = [];

    if (filters.queueOnly !== 'true') {
      journeyAssignments = await this.prisma.journeyTemplateAssignment.findMany(
        {
          where: {
            ...(role === 'ADMIN' ? {} : { coachId: userId }),
            ...(filters.status
              ? { status: toStoredAssignmentStatus(filters.status) }
              : {}),
          },
          include: journeyAssignmentInclude,
          orderBy: { createdAt: 'desc' },
        },
      );

      const validPlanIdSet = new Set(
        (
          await this.prisma.playerDevelopmentPlan.findMany({
            where: {
              id: {
                in: journeyAssignments.map(
                  (assignment) => assignment.playerPlanId,
                ),
              },
            },
            select: { id: true },
          })
        ).map((plan) => plan.id),
      );

      const invalidJourneyIds = journeyAssignments
        .filter((assignment) => !validPlanIdSet.has(assignment.playerPlanId))
        .map((assignment) => assignment.id);
      if (invalidJourneyIds.length > 0) {
        await this.prisma.journeyTemplateAssignment.deleteMany({
          where: { id: { in: invalidJourneyIds } },
        });
      }

      const queuedJourneyIds = journeyAssignments
        .filter(
          (assignment) =>
            validPlanIdSet.has(assignment.playerPlanId) &&
            assignment.isInTrainingQueue,
        )
        .map((assignment) => assignment.id);
      if (queuedJourneyIds.length > 0) {
        await this.prisma.journeyTemplateAssignment.updateMany({
          where: { id: { in: queuedJourneyIds } },
          data: { isInTrainingQueue: false },
        });
      }

      const validPlanIds = journeyAssignments
        .map((assignment) => assignment.playerPlanId)
        .filter((planId) => validPlanIdSet.has(planId));
      await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, validPlanIds);

      journeyAssignments = await this.prisma.journeyTemplateAssignment.findMany(
        {
          where: {
            ...(role === 'ADMIN' ? {} : { coachId: userId }),
            playerPlanId: { in: validPlanIds },
            ...(filters.status
              ? { status: toStoredAssignmentStatus(filters.status) }
              : {}),
          },
          include: journeyAssignmentInclude,
          orderBy: { createdAt: 'desc' },
        },
      );
    }

    const lessonAssignments = await this.prisma.lessonAssignment.findMany({
      where: {
        ...(role === 'ADMIN' ? {} : { coachId: userId }),
        ...(filters.status
          ? { status: toStoredAssignmentStatus(filters.status) }
          : {}),
        ...(filters.queueOnly === 'true' ? { isInTrainingQueue: true } : {}),
      },
      include: this.assignmentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    const journeyByPlanId = new Map(
      journeyAssignments.map((assignment) => [
        assignment.playerPlanId,
        assignment.journeyTemplate,
      ]),
    );

    const lessonItems = lessonAssignments.map((assignment) => ({
      ...this.toQueueLessonItem(assignment),
      journeyTemplate: assignment.block?.planId
        ? (journeyByPlanId.get(assignment.block.planId) ?? null)
        : null,
      playerPlanId: assignment.block?.planId ?? null,
    }));
    const journeyItems = journeyAssignments.map((assignment) => ({
      id: assignment.id,
      lessonId: null,
      targetType: AssignmentTargetType.PLAYER,
      sourceType: assignment.teamId
        ? AssignmentSourceType.TEAM
        : AssignmentSourceType.PLAYER,
      sourceReference: assignment.teamId ?? assignment.playerId,
      playerId: assignment.playerId,
      teamId: assignment.teamId,
      groupName: null,
      coachId: assignment.coachId,
      status: assignment.status,
      priority: LessonPriority.MEDIUM,
      isInTrainingQueue: assignment.isInTrainingQueue,
      dueDate: null,
      playerNotes: null,
      sortOrder: 0,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      lesson: null,
      player: assignment.player,
      team: assignment.team,
      teamEvent: null,
      calendarTask: null,
      itemType: 'journey' as const,
      isNew: assignment.status === AssignmentStatus.NEW,
      source: assignment.source,
      journeyTemplate: assignment.journeyTemplate,
      playerPlanId: assignment.playerPlanId,
    }));

    return [...lessonItems, ...journeyItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async listAssignmentsForCoachPlayer(
    coachId: string,
    role: string,
    playerId: string,
    filters: { status?: string; queueOnly?: string },
  ) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachPlayerLink(coachId, playerId);
    }

    const activeTeamIds = await this.getActiveTeamIdsForPlayer(playerId);
    let journeyAssignments: JourneyAssignmentListItem[] = [];

    if (filters.queueOnly !== 'true') {
      journeyAssignments = await this.prisma.journeyTemplateAssignment.findMany({
        where: {
          playerId,
          ...(role === 'ADMIN' ? {} : { coachId }),
          ...(filters.status
            ? { status: toStoredAssignmentStatus(filters.status) }
            : {}),
        },
        include: journeyAssignmentInclude,
        orderBy: { createdAt: 'desc' },
      });

      const validPlanIdSet = new Set(
        (
          await this.prisma.playerDevelopmentPlan.findMany({
            where: {
              id: {
                in: journeyAssignments.map((assignment) => assignment.playerPlanId),
              },
            },
            select: { id: true },
          })
        ).map((plan) => plan.id),
      );

      const invalidJourneyIds = journeyAssignments
        .filter((assignment) => !validPlanIdSet.has(assignment.playerPlanId))
        .map((assignment) => assignment.id);
      if (invalidJourneyIds.length > 0) {
        await this.prisma.journeyTemplateAssignment.deleteMany({
          where: { id: { in: invalidJourneyIds } },
        });
      }

      const queuedJourneyIds = journeyAssignments
        .filter(
          (assignment) =>
            validPlanIdSet.has(assignment.playerPlanId) &&
            assignment.isInTrainingQueue,
        )
        .map((assignment) => assignment.id);
      if (queuedJourneyIds.length > 0) {
        await this.prisma.journeyTemplateAssignment.updateMany({
          where: { id: { in: queuedJourneyIds } },
          data: { isInTrainingQueue: false },
        });
      }

      const validPlanIds = journeyAssignments
        .map((assignment) => assignment.playerPlanId)
        .filter((planId) => validPlanIdSet.has(planId));
      await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, validPlanIds);

      journeyAssignments = await this.prisma.journeyTemplateAssignment.findMany({
        where: {
          playerId,
          ...(role === 'ADMIN' ? {} : { coachId }),
          playerPlanId: { in: validPlanIds },
          ...(filters.status
            ? { status: toStoredAssignmentStatus(filters.status) }
            : {}),
        },
        include: journeyAssignmentInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    const lessonAssignments = await this.prisma.lessonAssignment.findMany({
      where: {
        ...(role === 'ADMIN' ? {} : { coachId }),
        OR: [
          { targetType: AssignmentTargetType.PLAYER, playerId },
          ...(activeTeamIds.length > 0
            ? [
                {
                  targetType: AssignmentTargetType.TEAM,
                  teamId: { in: activeTeamIds },
                },
              ]
            : []),
        ],
        ...(filters.status
          ? { status: toStoredAssignmentStatus(filters.status) }
          : {}),
        ...(filters.queueOnly === 'true' ? { isInTrainingQueue: true } : {}),
      },
      include: this.assignmentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    const journeyByPlanId = new Map(
      journeyAssignments.map((assignment) => [
        assignment.playerPlanId,
        assignment.journeyTemplate,
      ]),
    );

    const lessonItems = lessonAssignments.map((assignment) => ({
      ...this.toQueueLessonItem(assignment),
      journeyTemplate: assignment.block?.planId
        ? (journeyByPlanId.get(assignment.block.planId) ?? null)
        : null,
      playerPlanId: assignment.block?.planId ?? null,
    }));
    const journeyItems = journeyAssignments.map((assignment) => ({
      id: assignment.id,
      lessonId: null,
      targetType: AssignmentTargetType.PLAYER,
      sourceType: assignment.teamId
        ? AssignmentSourceType.TEAM
        : AssignmentSourceType.PLAYER,
      sourceReference: assignment.teamId ?? assignment.playerId,
      playerId: assignment.playerId,
      teamId: assignment.teamId,
      groupName: null,
      coachId: assignment.coachId,
      status: assignment.status,
      priority: LessonPriority.MEDIUM,
      isInTrainingQueue: assignment.isInTrainingQueue,
      dueDate: null,
      playerNotes: null,
      sortOrder: 0,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      lesson: null,
      player: assignment.player,
      team: assignment.team,
      teamEvent: null,
      calendarTask: null,
      block: null,
      itemType: 'journey' as const,
      isNew: assignment.status === AssignmentStatus.NEW,
      source: assignment.source,
      journeyTemplate: assignment.journeyTemplate,
      playerPlanId: assignment.playerPlanId,
    }));

    return [...lessonItems, ...journeyItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async updateAssignment(
    userId: string,
    role: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
  ) {
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        coachId: true,
        playerId: true,
        teamId: true,
        targetType: true,
        status: true,
        completedAt: true,
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const isCoachOrAdmin = role === 'COACH' || role === 'ADMIN';
    if (isCoachOrAdmin) {
      if (role !== 'ADMIN' && assignment.coachId !== userId) {
        throw new ForbiddenException('Not your assignment');
      }
    } else {
      const canAccess = await this.resolvePlayerAccess(assignment, userId);
      if (!canAccess) throw new ForbiddenException('Not your assignment');
      const triesToEditRestrictedFields =
        Object.prototype.hasOwnProperty.call(data, 'dueDate') ||
        Object.prototype.hasOwnProperty.call(data, 'priority') ||
        Object.prototype.hasOwnProperty.call(data, 'sortOrder');
      if (triesToEditRestrictedFields) {
        throw new ForbiddenException(
          'Players can only update progress and queue state',
        );
      }
    }

    const nextStatus =
      data.status !== undefined
        ? toStoredAssignmentStatus(data.status)
        : assignment.status;

    return this.prisma.lessonAssignment
      .update({
        where: { id: assignmentId },
        data: {
          ...(data.status !== undefined ? { status: nextStatus } : {}),
          ...(data.status !== undefined
            ? nextStatus === AssignmentStatus.COMPLETED
              ? { completedAt: assignment.completedAt ?? new Date() }
              : assignment.status === AssignmentStatus.COMPLETED
                ? { completedAt: null, coachReviewedAt: null }
                : {}
            : {}),
          // New player input on a lesson puts it back into the coach's
          // feedback inbox.
          ...(!isCoachOrAdmin &&
          (data.playerNotes !== undefined || data.selfAssessment !== undefined)
            ? { coachReviewedAt: null }
            : {}),
          ...(data.playerNotes !== undefined
            ? { playerNotes: data.playerNotes }
            : {}),
          ...(data.selfAssessment !== undefined
            ? { selfAssessment: data.selfAssessment }
            : {}),
          ...(data.dueDate !== undefined
            ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
            : {}),
          ...(data.priority !== undefined
            ? { priority: data.priority as LessonPriority }
            : {}),
          ...(data.sortOrder !== undefined
            ? { sortOrder: data.sortOrder }
            : {}),
          ...(data.isInTrainingQueue !== undefined
            ? { isInTrainingQueue: Boolean(data.isInTrainingQueue) }
            : {}),
        },
        include: this.assignmentInclude(),
      })
      .then(async (updated) => {
        if (updated.block?.planId) {
          await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, [
            updated.block.planId,
          ]);
        }
        return updated;
      });
  }

  async moveToQueue(userId: string, role: string, assignmentId: string) {
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        coachId: true,
        playerId: true,
        teamId: true,
        targetType: true,
        status: true,
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (role === 'PLAYER') {
      const canAccess = await this.resolvePlayerAccess(assignment, userId);
      if (!canAccess) throw new ForbiddenException('Not your assignment');
    } else {
      this.requireCoachOrAdmin(role);
      if (role !== 'ADMIN' && assignment.coachId !== userId) {
        throw new ForbiddenException('Not your assignment');
      }
    }

    return this.prisma.lessonAssignment
      .update({
        where: { id: assignmentId },
        data: {
          isInTrainingQueue: true,
          status:
            assignment.targetType === AssignmentTargetType.PLAYER
              ? AssignmentStatus.OPEN
              : undefined,
          ...(assignment.status === AssignmentStatus.COMPLETED
            ? { completedAt: null, coachReviewedAt: null }
            : {}),
        },
        include: this.assignmentInclude(),
      })
      .then(async (updated) => {
        if (updated.block?.planId) {
          await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, [
            updated.block.planId,
          ]);
        }
        return updated;
      });
  }

  async deleteAssignment(userId: string, role: string, assignmentId: string) {
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        coachId: true,
        playerId: true,
        teamId: true,
        targetType: true,
        block: {
          select: {
            planId: true,
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const isCoachOrAdmin = role === 'COACH' || role === 'ADMIN';
    if (isCoachOrAdmin) {
      if (role !== 'ADMIN' && assignment.coachId !== userId) {
        throw new ForbiddenException('Not your assignment');
      }
    } else {
      const canAccess = await this.resolvePlayerAccess(assignment, userId);
      if (!canAccess) throw new ForbiddenException('Not your assignment');
    }

    await this.prisma.lessonAssignment.delete({ where: { id: assignmentId } });

    if (assignment.block?.planId) {
      await syncJourneyAssignmentLifecycleForPlanIds(this.prisma, [
        assignment.block.planId,
      ]);
    }

    return { ok: true };
  }
}
