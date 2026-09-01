import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignmentTargetType,
  AssignmentStatus,
  DevelopmentMilestoneStatus,
  LessonPriority,
  OwnerType,
  Prisma,
} from '@challengepoint/db';

@Injectable()
export class DevelopmentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCoachOrAdmin(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only coaches and admins can manage development plans',
      );
    }
  }

  private async assertCoachPlayerLink(coachId: string, playerId: string) {
    const link = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
    });
    if (!link) {
      throw new ForbiddenException('Not linked to this player');
    }
  }

  private async assertCoachOwnsTeam(coachId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException('Not your team');
    return team;
  }

  private async getActiveTeamIdsForPlayer(playerId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: playerId },
      select: { teamId: true },
    });
    return memberships.map((membership) => membership.teamId);
  }

  private planInclude(assignmentWhere?: Prisma.LessonAssignmentWhereInput) {
    return {
      coach: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      player: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      team: { select: { id: true, shortName: true, icon: true } },
      milestones: {
        orderBy: { dueDate: 'asc' as const },
        include: {
          block: { select: { id: true, name: true } },
        },
      },
      blocks: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          assignments: {
            ...(assignmentWhere ? { where: assignmentWhere } : {}),
            orderBy: { sortOrder: 'asc' as const },
            include: {
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
              team: { select: { id: true, shortName: true, icon: true } },
            },
          },
        },
      },
    };
  }

  // ─── Plans ────────────────────────────────────────────────────────────────

  async listPlansForPlayer(coachId: string, role: string, playerId: string) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachPlayerLink(coachId, playerId);
    }
    const activeTeamIds = await this.getActiveTeamIdsForPlayer(playerId);
    const assignmentWhere: Prisma.LessonAssignmentWhereInput = {
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
        { targetType: AssignmentTargetType.GROUP },
      ],
    };
    return this.prisma.playerDevelopmentPlan.findMany({
      where: {
        ...(role === 'ADMIN' ? {} : { coachId }),
        OR: [
          { ownerType: OwnerType.PLAYER, playerId },
          ...(activeTeamIds.length > 0
            ? [{ ownerType: OwnerType.TEAM, teamId: { in: activeTeamIds } }]
            : []),
        ],
      },
      include: this.planInclude(assignmentWhere),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlayerPlansAsPlayer(playerId: string) {
    const activeTeamIds = await this.getActiveTeamIdsForPlayer(playerId);
    const assignmentWhere: Prisma.LessonAssignmentWhereInput = {
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
        { targetType: AssignmentTargetType.GROUP },
      ],
    };
    return this.prisma.playerDevelopmentPlan.findMany({
      where: {
        OR: [
          { ownerType: OwnerType.PLAYER, playerId },
          ...(activeTeamIds.length > 0
            ? [{ ownerType: OwnerType.TEAM, teamId: { in: activeTeamIds } }]
            : []),
        ],
      },
      include: this.planInclude(assignmentWhere),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCoachPlans(coachId: string, role: string) {
    this.requireCoachOrAdmin(role);
    return this.prisma.playerDevelopmentPlan.findMany({
      where: role === 'ADMIN' ? {} : { coachId },
      include: this.planInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listPlansForTeam(coachId: string, role: string, teamId: string) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(coachId, teamId);
    }
    return this.prisma.playerDevelopmentPlan.findMany({
      where: {
        ownerType: OwnerType.TEAM,
        teamId,
        ...(role === 'ADMIN' ? {} : { coachId }),
      },
      include: this.planInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPlan(
    coachId: string,
    role: string,
    data: {
      playerId?: string;
      teamId?: string;
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const hasPlayerOwner = Boolean(data.playerId);
    const hasTeamOwner = Boolean(data.teamId);
    if (hasPlayerOwner === hasTeamOwner) {
      throw new ForbiddenException(
        'A development plan must belong to exactly one player or one team',
      );
    }
    if (data.playerId && role !== 'ADMIN') {
      await this.assertCoachPlayerLink(coachId, data.playerId);
    }
    if (data.teamId && role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(coachId, data.teamId);
    }
    return this.prisma.playerDevelopmentPlan.create({
      data: {
        coachId,
        ownerType: data.teamId ? OwnerType.TEAM : OwnerType.PLAYER,
        playerId: data.playerId ?? null,
        teamId: data.teamId ?? null,
        name: data.name,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: this.planInclude(),
    });
  }

  async updatePlan(
    coachId: string,
    role: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const plan = await this.prisma.playerDevelopmentPlan.findUnique({
      where: { id },
      include: { team: { select: { coachId: true } } },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (role !== 'ADMIN' && plan.coachId !== coachId)
      throw new ForbiddenException('Not your plan');
    return this.prisma.playerDevelopmentPlan.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? new Date(data.endDate) : null }
          : {}),
      },
    });
  }

  async deletePlan(coachId: string, role: string, id: string) {
    this.requireCoachOrAdmin(role);
    const plan = await this.prisma.playerDevelopmentPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (role !== 'ADMIN' && plan.coachId !== coachId)
      throw new ForbiddenException('Not your plan');
    await this.prisma.playerDevelopmentPlan.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Training Blocks ──────────────────────────────────────────────────────

  async createBlock(
    coachId: string,
    role: string,
    planId: string,
    data: {
      name: string;
      description?: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
      sortOrder?: number;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const plan = await this.prisma.playerDevelopmentPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (role !== 'ADMIN' && plan.coachId !== coachId)
      throw new ForbiddenException('Not your plan');
    return this.prisma.trainingBlock.create({
      data: {
        planId,
        coachId,
        name: data.name,
        description: data.description,
        goal: data.goal,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        assignments: {
          include: {
            lesson: {
              select: {
                id: true,
                name: true,
                focusArea: true,
                durationMinutes: true,
                subCapability: true,
                subSubCapability: true,
              },
            },
          },
        },
      },
    });
  }

  async updateBlock(
    coachId: string,
    role: string,
    blockId: string,
    data: {
      name?: string;
      description?: string;
      goal?: string;
      startDate?: string | null;
      endDate?: string | null;
      sortOrder?: number;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const block = await this.prisma.trainingBlock.findUnique({
      where: { id: blockId },
    });
    if (!block) throw new NotFoundException('Block not found');
    if (role !== 'ADMIN' && block.coachId !== coachId)
      throw new ForbiddenException('Not your block');
    return this.prisma.trainingBlock.update({
      where: { id: blockId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.goal !== undefined ? { goal: data.goal } : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.endDate !== undefined
          ? { endDate: data.endDate ? new Date(data.endDate) : null }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async deleteBlock(coachId: string, role: string, blockId: string) {
    this.requireCoachOrAdmin(role);
    const block = await this.prisma.trainingBlock.findUnique({
      where: { id: blockId },
    });
    if (!block) throw new NotFoundException('Block not found');
    if (role !== 'ADMIN' && block.coachId !== coachId)
      throw new ForbiddenException('Not your block');
    await this.prisma.trainingBlock.delete({ where: { id: blockId } });
    return { ok: true };
  }

  // ─── Lesson Assignments ───────────────────────────────────────────────────

  async addAssignment(
    coachId: string,
    role: string,
    blockId: string,
    data: {
      lessonId: string;
      playerId?: string;
      teamId?: string;
      targetType?: string;
      groupName?: string;
      dueDate?: string;
      priority?: string;
      sortOrder?: number;
      isInTrainingQueue?: boolean;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const block = await this.prisma.trainingBlock.findUnique({
      where: { id: blockId },
      include: { plan: true },
    });
    if (!block) throw new NotFoundException('Block not found');
    if (role !== 'ADMIN' && block.coachId !== coachId)
      throw new ForbiddenException('Not your block');
    if (!block.plan) {
      throw new ForbiddenException('Block does not belong to a plan');
    }

    const requestedTarget = data.targetType as AssignmentTargetType | undefined;
    const inferredTarget =
      requestedTarget ??
      (data.playerId
        ? AssignmentTargetType.PLAYER
        : data.teamId
          ? AssignmentTargetType.TEAM
          : block.plan.ownerType === OwnerType.TEAM
            ? AssignmentTargetType.TEAM
            : AssignmentTargetType.PLAYER);

    let playerId: string | null = null;
    let teamId: string | null = null;
    let groupName: string | null = null;

    if (inferredTarget === AssignmentTargetType.PLAYER) {
      playerId = data.playerId ?? block.plan.playerId ?? null;
      if (!playerId) {
        throw new ForbiddenException('Player assignment requires a player target');
      }
      if (role !== 'ADMIN') {
        await this.assertCoachPlayerLink(coachId, playerId);
      }
    } else if (inferredTarget === AssignmentTargetType.TEAM) {
      teamId = data.teamId ?? block.plan.teamId ?? null;
      if (!teamId) {
        throw new ForbiddenException('Team assignment requires a team target');
      }
      if (role !== 'ADMIN') {
        await this.assertCoachOwnsTeam(coachId, teamId);
      }
    } else {
      groupName = data.groupName?.trim() || null;
      if (!groupName) {
        throw new ForbiddenException('Group assignment requires a group name');
      }
    }

    return this.prisma.lessonAssignment.create({
      data: {
        blockId,
        lessonId: data.lessonId,
        targetType: inferredTarget,
        playerId,
        teamId,
        groupName,
        coachId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isInTrainingQueue: Boolean(data.isInTrainingQueue),
        priority: (data.priority ?? LessonPriority.MEDIUM) as LessonPriority,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        lesson: {
          select: {
            id: true,
            name: true,
            focusArea: true,
            durationMinutes: true,
            subCapability: true,
            subSubCapability: true,
          },
        },
        team: { select: { id: true, shortName: true, icon: true } },
      },
    });
  }

  async updateAssignment(
    userId: string,
    role: string,
    assignmentId: string,
    data: {
      status?: string;
      dueDate?: string | null;
      priority?: string;
      sortOrder?: number;
      playerNotes?: string;
      selfAssessment?: number | null;
      isInTrainingQueue?: boolean;
    },
  ) {
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    // Coaches/admins can update all fields; players can only update status, notes, selfAssessment
    const isCoachOrAdmin = role === 'COACH' || role === 'ADMIN';
    if (isCoachOrAdmin && role !== 'ADMIN' && assignment.coachId !== userId) {
      throw new ForbiddenException('Not your assignment');
    }

    if (!isCoachOrAdmin) {
      const isPersonalAssignment =
        assignment.targetType === AssignmentTargetType.PLAYER &&
        assignment.playerId === userId;
      const isTeamAssignment =
        assignment.targetType === AssignmentTargetType.TEAM &&
        assignment.teamId &&
        (await this.prisma.teamMember.findFirst({
          where: { teamId: assignment.teamId, userId },
          select: { id: true },
        }));
      if (!isPersonalAssignment && !isTeamAssignment) {
        throw new ForbiddenException('Not your assignment');
      }
    }

    const updateData: Prisma.LessonAssignmentUpdateInput = {};
    if (data.status !== undefined)
      updateData.status = data.status as AssignmentStatus;
    if (data.playerNotes !== undefined)
      updateData.playerNotes = data.playerNotes;
    if (data.selfAssessment !== undefined)
      updateData.selfAssessment = data.selfAssessment;
    if (isCoachOrAdmin) {
      if (data.dueDate !== undefined)
        updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.priority !== undefined)
        updateData.priority = data.priority as LessonPriority;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      if (Object.prototype.hasOwnProperty.call(data, 'isInTrainingQueue')) {
        updateData.isInTrainingQueue = Boolean(
          (data as { isInTrainingQueue?: boolean }).isInTrainingQueue,
        );
      }
    }

    return this.prisma.lessonAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        lesson: {
          select: {
            id: true,
            name: true,
            focusArea: true,
            durationMinutes: true,
            subCapability: true,
            subSubCapability: true,
          },
        },
        team: { select: { id: true, shortName: true, icon: true } },
      },
    });
  }

  async removeAssignment(coachId: string, role: string, assignmentId: string) {
    this.requireCoachOrAdmin(role);
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (role !== 'ADMIN' && assignment.coachId !== coachId)
      throw new ForbiddenException('Not your block');
    await this.prisma.lessonAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  async createMilestone(
    coachId: string,
    role: string,
    planId: string,
    data: {
      title: string;
      description?: string;
      dueDate: string;
      blockId?: string;
      status?: string;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const plan = await this.prisma.playerDevelopmentPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (role !== 'ADMIN' && plan.coachId !== coachId)
      throw new ForbiddenException('Not your plan');
    if (data.blockId) {
      const block = await this.prisma.trainingBlock.findUnique({
        where: { id: data.blockId },
      });
      if (!block || block.planId !== planId)
        throw new ForbiddenException('Block does not belong to this plan');
    }
    return this.prisma.developmentPlanMilestone.create({
      data: {
        planId,
        blockId: data.blockId ?? null,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        status: (data.status ??
          DevelopmentMilestoneStatus.PLANNED) as DevelopmentMilestoneStatus,
      },
      include: {
        block: { select: { id: true, name: true } },
      },
    });
  }

  async updateMilestone(
    coachId: string,
    role: string,
    milestoneId: string,
    data: {
      title?: string;
      description?: string | null;
      dueDate?: string;
      blockId?: string | null;
      status?: string;
    },
  ) {
    this.requireCoachOrAdmin(role);
    const milestone = await this.prisma.developmentPlanMilestone.findUnique({
      where: { id: milestoneId },
      include: { plan: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (role !== 'ADMIN' && milestone.plan.coachId !== coachId)
      throw new ForbiddenException('Not your milestone');
    if (data.blockId) {
      const block = await this.prisma.trainingBlock.findUnique({
        where: { id: data.blockId },
      });
      if (!block || block.planId !== milestone.planId)
        throw new ForbiddenException('Block does not belong to this plan');
    }
    const updateData: Prisma.DevelopmentPlanMilestoneUncheckedUpdateInput = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: new Date(data.dueDate) }
        : {}),
      ...(data.blockId !== undefined ? { blockId: data.blockId } : {}),
      ...(data.status !== undefined
        ? { status: data.status as DevelopmentMilestoneStatus }
        : {}),
    };

    return this.prisma.developmentPlanMilestone.update({
      where: { id: milestoneId },
      data: updateData,
      include: {
        block: { select: { id: true, name: true } },
      },
    });
  }

  async deleteMilestone(coachId: string, role: string, milestoneId: string) {
    this.requireCoachOrAdmin(role);
    const milestone = await this.prisma.developmentPlanMilestone.findUnique({
      where: { id: milestoneId },
      include: { plan: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (role !== 'ADMIN' && milestone.plan.coachId !== coachId)
      throw new ForbiddenException('Not your milestone');
    await this.prisma.developmentPlanMilestone.delete({
      where: { id: milestoneId },
    });
    return { ok: true };
  }
}
