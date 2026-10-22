import {
  AssignmentStatus,
  AssignmentTargetType,
  OwnerType,
} from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';

export type LifecycleStatus = 'PENDING' | 'ACCEPTED' | 'ACTIVE' | 'COMPLETED';

export type LifecycleCounts = Record<LifecycleStatus, number>;

export type PlayerLearningSummary = {
  lessons: LifecycleCounts;
  journeys: LifecycleCounts;
  recentCompletions: {
    lessons: number;
    journeys: number;
  };
};

export function createLifecycleCounts(): LifecycleCounts {
  return {
    PENDING: 0,
    ACCEPTED: 0,
    ACTIVE: 0,
    COMPLETED: 0,
  };
}

export function toStoredAssignmentStatus(
  status?: string | null,
): AssignmentStatus {
  switch (status) {
    case 'PENDING':
    case 'NEW':
      return AssignmentStatus.NEW;
    case 'ACCEPTED':
    case 'OPEN':
      return AssignmentStatus.OPEN;
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return AssignmentStatus.IN_PROGRESS;
    case 'COMPLETED':
    case 'ARCHIVED':
      return AssignmentStatus.COMPLETED;
    default:
      return AssignmentStatus.NEW;
  }
}

export function toLifecycleStatus(status?: string | null): LifecycleStatus {
  switch (status) {
    case AssignmentStatus.NEW:
    case 'PENDING':
      return 'PENDING';
    case AssignmentStatus.OPEN:
    case 'ACCEPTED':
      return 'ACCEPTED';
    case AssignmentStatus.IN_PROGRESS:
    case 'ACTIVE':
      return 'ACTIVE';
    case AssignmentStatus.COMPLETED:
    case AssignmentStatus.ARCHIVED:
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return 'PENDING';
  }
}

export function deriveJourneyAssignmentStatus(
  lessonStatuses: Array<string | null | undefined>,
  currentStatus?: string | null,
): AssignmentStatus {
  const currentLifecycle = toLifecycleStatus(currentStatus);
  if (lessonStatuses.length === 0) {
    return toStoredAssignmentStatus(currentStatus);
  }

  const lifecycleStatuses = lessonStatuses.map((status) =>
    toLifecycleStatus(status),
  );

  if (lifecycleStatuses.every((status) => status === 'COMPLETED')) {
    return AssignmentStatus.COMPLETED;
  }

  if (
    lifecycleStatuses.some(
      (status) => status === 'ACTIVE' || status === 'COMPLETED',
    )
  ) {
    return AssignmentStatus.IN_PROGRESS;
  }

  if (currentLifecycle === 'ACCEPTED') {
    return AssignmentStatus.OPEN;
  }

  if (currentLifecycle === 'PENDING') {
    return AssignmentStatus.NEW;
  }

  return AssignmentStatus.OPEN;
}

function getCompletedAtUpdate(
  currentStatus: string | null | undefined,
  nextStatus: AssignmentStatus,
  currentCompletedAt: Date | null | undefined,
): Date | null | undefined {
  if (nextStatus === AssignmentStatus.COMPLETED) {
    return currentCompletedAt ?? new Date();
  }

  if (toLifecycleStatus(currentStatus) === 'COMPLETED') {
    return null;
  }

  return undefined;
}

export async function syncJourneyAssignmentLifecycleForPlanIds(
  prisma: PrismaService,
  planIds: string[],
) {
  const uniquePlanIds = [...new Set(planIds.filter(Boolean))];
  if (uniquePlanIds.length === 0) return;

  const journeyAssignments = await prisma.journeyTemplateAssignment.findMany({
    where: { playerPlanId: { in: uniquePlanIds } },
    select: {
      id: true,
      playerPlanId: true,
      status: true,
      completedAt: true,
      isInTrainingQueue: true,
    },
  });

  if (journeyAssignments.length === 0) return;

  const lessonAssignments = await prisma.lessonAssignment.findMany({
    where: {
      block: {
        planId: { in: uniquePlanIds },
      },
    },
    select: {
      status: true,
      block: {
        select: {
          planId: true,
        },
      },
    },
  });

  const statusesByPlanId = new Map<string, string[]>();
  for (const lessonAssignment of lessonAssignments) {
    const planId = lessonAssignment.block?.planId;
    if (!planId) continue;
    const statuses = statusesByPlanId.get(planId) ?? [];
    statuses.push(lessonAssignment.status);
    statusesByPlanId.set(planId, statuses);
  }

  await Promise.all(
    journeyAssignments.map((assignment) => {
      const nextStatus = deriveJourneyAssignmentStatus(
        statusesByPlanId.get(assignment.playerPlanId) ?? [],
        assignment.status,
      );
      const shouldLeaveQueue = assignment.isInTrainingQueue;
      const completedAtUpdate = getCompletedAtUpdate(
        assignment.status,
        nextStatus,
        assignment.completedAt,
      );
      if (
        !shouldLeaveQueue &&
        nextStatus === assignment.status &&
        completedAtUpdate === undefined
      ) {
        return Promise.resolve(null);
      }

      return prisma.journeyTemplateAssignment.update({
        where: { id: assignment.id },
        data: {
          status: nextStatus,
          ...(completedAtUpdate !== undefined
            ? { completedAt: completedAtUpdate }
            : {}),
          ...(shouldLeaveQueue ? { isInTrainingQueue: false } : {}),
        },
      });
    }),
  );
}

export async function loadPlayerLearningSummaries(
  prisma: PrismaService,
  playerIds: string[],
  options: {
    /**
     * Only count plans, lessons and journeys created by this coach. A scoped
     * load is read-only: it skips the clean-up and status sync below, which
     * must only run on the complete (unscoped) data set.
     */
    coachId?: string;
  } = {},
): Promise<Record<string, PlayerLearningSummary>> {
  const coachId = options.coachId;
  const coachFilter = coachId ? { coachId } : {};
  const recentCompletionThreshold = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  );
  const uniquePlayerIds = [...new Set(playerIds.filter(Boolean))];
  if (uniquePlayerIds.length === 0) return {};

  const summaries = Object.fromEntries(
    uniquePlayerIds.map((playerId) => [
      playerId,
      {
        lessons: createLifecycleCounts(),
        journeys: createLifecycleCounts(),
        recentCompletions: {
          lessons: 0,
          journeys: 0,
        },
      },
    ]),
  ) as Record<string, PlayerLearningSummary>;

  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId: { in: uniquePlayerIds } },
    select: { userId: true, teamId: true },
  });

  const teamIdsByPlayerId = new Map<string, Set<string>>();
  const playerIdsByTeamId = new Map<string, Set<string>>();
  for (const membership of teamMemberships) {
    const playerTeamIds = teamIdsByPlayerId.get(membership.userId) ?? new Set();
    playerTeamIds.add(membership.teamId);
    teamIdsByPlayerId.set(membership.userId, playerTeamIds);

    const teamPlayerIds = playerIdsByTeamId.get(membership.teamId) ?? new Set();
    teamPlayerIds.add(membership.userId);
    playerIdsByTeamId.set(membership.teamId, teamPlayerIds);
  }

  const allTeamIds = [...new Set(teamMemberships.map((membership) => membership.teamId))];

  const [plans, lessonAssignments, rawJourneyAssignments] = await Promise.all([
    prisma.playerDevelopmentPlan.findMany({
      where: {
        ...coachFilter,
        OR: [
          { ownerType: OwnerType.PLAYER, playerId: { in: uniquePlayerIds } },
          ...(allTeamIds.length > 0
            ? [{ ownerType: OwnerType.TEAM, teamId: { in: allTeamIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        ownerType: true,
        playerId: true,
        teamId: true,
      },
    }),
    prisma.lessonAssignment.findMany({
      where: {
        ...coachFilter,
        OR: [
          { playerId: { in: uniquePlayerIds } },
          ...(allTeamIds.length > 0
            ? [
                {
                  targetType: AssignmentTargetType.TEAM,
                  teamId: { in: allTeamIds },
                },
              ]
            : []),
        ],
      },
      select: {
        targetType: true,
        playerId: true,
        teamId: true,
        status: true,
        completedAt: true,
        block: {
          select: {
            planId: true,
          },
        },
      },
    }),
    prisma.journeyTemplateAssignment.findMany({
      where: { ...coachFilter, playerId: { in: uniquePlayerIds } },
      select: {
        id: true,
        playerId: true,
        playerPlanId: true,
        status: true,
        isInTrainingQueue: true,
        completedAt: true,
      },
    }),
  ]);

  const validPlanIdSet = new Set(plans.map((plan) => plan.id));
  const journeyPlanIds = [
    ...new Set(rawJourneyAssignments.map((assignment) => assignment.playerPlanId)),
  ];

  const invalidJourneyIds = rawJourneyAssignments
    .filter((assignment) => !validPlanIdSet.has(assignment.playerPlanId))
    .map((assignment) => assignment.id);

  if (!coachId && invalidJourneyIds.length > 0) {
    await prisma.journeyTemplateAssignment.deleteMany({
      where: { id: { in: invalidJourneyIds } },
    });
  }

  const journeyAssignments = rawJourneyAssignments.filter((assignment) =>
    validPlanIdSet.has(assignment.playerPlanId),
  );

  const lessonAssignmentsByPlanId = new Map<
    string,
    Array<{
      targetType: AssignmentTargetType;
      playerId: string | null;
      teamId: string | null;
      status: AssignmentStatus;
      completedAt: Date | null;
    }>
  >();
  for (const assignment of lessonAssignments) {
    const planId = assignment.block?.planId;
    if (!planId) continue;
    const list = lessonAssignmentsByPlanId.get(planId) ?? [];
    list.push({
      targetType: assignment.targetType,
      playerId: assignment.playerId,
      teamId: assignment.teamId,
      status: assignment.status,
      completedAt: assignment.completedAt,
    });
    lessonAssignmentsByPlanId.set(planId, list);
  }

  const pendingJourneyKeys = new Set<string>();
  const journeyAssignmentByPlayerPlanKey = new Map<
    string,
    (typeof journeyAssignments)[number]
  >();

  for (const assignment of journeyAssignments) {
    const key = `${assignment.playerId}:${assignment.playerPlanId}`;
    journeyAssignmentByPlayerPlanKey.set(key, assignment);
  }

  const syncUpdates: Array<Promise<unknown>> = [];

  for (const plan of plans) {
    const planAssignments = lessonAssignmentsByPlanId.get(plan.id) ?? [];
    const relatedPlayerIds =
      plan.ownerType === OwnerType.PLAYER
        ? plan.playerId
          ? [plan.playerId]
          : []
        : plan.teamId
          ? [...(playerIdsByTeamId.get(plan.teamId) ?? new Set())]
          : [];

    for (const playerId of relatedPlayerIds) {
      if (!summaries[playerId]) continue;
      const teamIdsForPlayer = teamIdsByPlayerId.get(playerId) ?? new Set();
      const relevantAssignments = planAssignments.filter((assignment) => {
        if (assignment.targetType === AssignmentTargetType.PLAYER) {
          return assignment.playerId === playerId;
        }
        if (assignment.targetType === AssignmentTargetType.TEAM) {
          return (
            Boolean(assignment.teamId) &&
            teamIdsForPlayer.has(assignment.teamId as string)
          );
        }
        return true;
      });

      const key = `${playerId}:${plan.id}`;
      const linkedJourneyAssignment = journeyAssignmentByPlayerPlanKey.get(key);
      const nextStatus = deriveJourneyAssignmentStatus(
        relevantAssignments.map((assignment) => assignment.status),
        linkedJourneyAssignment?.status ?? AssignmentStatus.NEW,
      );
      const lifecycleStatus = toLifecycleStatus(nextStatus);
      summaries[playerId].journeys[lifecycleStatus] += 1;
      if (lifecycleStatus === 'PENDING') {
        pendingJourneyKeys.add(key);
      }

      if (lifecycleStatus === 'COMPLETED') {
        const lessonCompletionTimestamps = relevantAssignments
          .map((assignment) => assignment.completedAt?.getTime() ?? 0)
          .filter((timestamp) => timestamp > 0);
        const latestLessonCompletion =
          lessonCompletionTimestamps.length > 0
            ? new Date(Math.max(...lessonCompletionTimestamps))
            : null;
        const completedAt =
          linkedJourneyAssignment?.completedAt ?? latestLessonCompletion;
        if (completedAt && completedAt >= recentCompletionThreshold) {
          summaries[playerId].recentCompletions.journeys += 1;
        }
      }

      if (!coachId && linkedJourneyAssignment) {
        const completedAtUpdate = getCompletedAtUpdate(
          linkedJourneyAssignment.status,
          nextStatus,
          linkedJourneyAssignment.completedAt,
        );
        if (
          nextStatus !== linkedJourneyAssignment.status ||
          linkedJourneyAssignment.isInTrainingQueue ||
          completedAtUpdate !== undefined
        ) {
          syncUpdates.push(
            prisma.journeyTemplateAssignment.update({
              where: { id: linkedJourneyAssignment.id },
              data: {
                status: nextStatus,
                ...(completedAtUpdate !== undefined
                  ? { completedAt: completedAtUpdate }
                  : {}),
                ...(linkedJourneyAssignment.isInTrainingQueue
                  ? { isInTrainingQueue: false }
                  : {}),
              },
            }),
          );
        }
      }
    }
  }

  if (syncUpdates.length > 0) {
    await Promise.all(syncUpdates);
  }

  const planIdSet = new Set(plans.map((plan) => plan.id));

  for (const assignment of lessonAssignments) {
    for (const playerId of uniquePlayerIds) {
      const playerTeamIds = teamIdsByPlayerId.get(playerId) ?? new Set();
      const visibleToPlayer =
        (assignment.targetType === AssignmentTargetType.PLAYER &&
          assignment.playerId === playerId) ||
        (assignment.targetType === AssignmentTargetType.TEAM &&
          assignment.teamId &&
          playerTeamIds.has(assignment.teamId));
      if (!visibleToPlayer) continue;

      const planId = assignment.block?.planId;
      if (
        planId &&
        planIdSet.has(planId) &&
        pendingJourneyKeys.has(`${playerId}:${planId}`)
      ) {
        continue;
      }

      const lifecycleStatus = toLifecycleStatus(assignment.status);
      summaries[playerId].lessons[lifecycleStatus] += 1;
      if (
        lifecycleStatus === 'COMPLETED' &&
        assignment.completedAt &&
        assignment.completedAt >= recentCompletionThreshold
      ) {
        summaries[playerId].recentCompletions.lessons += 1;
      }
    }
  }

  if (!coachId && journeyPlanIds.length > 0) {
    await syncJourneyAssignmentLifecycleForPlanIds(prisma, journeyPlanIds);
  }

  return summaries;
}
